import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db/pg";
import * as s from "@/db/schema";
import { logActivity } from "@/server/activity";
import { actorIdOf } from "@/server/auth";
import { userFromRequest } from "@/server/http";
import { canAccessDocument, canUploadDocument, validateDocument } from "@/server/document-access";
import { extensionFor, getStorage } from "@/server/storage";

/** Upload a certificate document. Server-side validation of type and size. */
export async function POST(req: Request, ctx: { params: Promise<{ certId: string }> }) {
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!canUploadDocument(user.role)) return NextResponse.json({ error: "Not permitted." }, { status: 403 });

  const { certId } = await ctx.params;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided." }, { status: 400 });
  const invalid = validateDocument(file.type, file.size);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 415 });

  const db = getDb();
  const [cert] = await db.select({ id: s.certification.id }).from(s.certification).where(eq(s.certification.id, certId)).limit(1);
  if (!cert) return NextResponse.json({ error: "Certification not found." }, { status: 404 });

  const key = `certifications/${certId}/${randomUUID()}.${extensionFor(file.type)}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await getStorage().put(key, buffer, file.type);

  const actorId = actorIdOf(user);
  await db
    .update(s.certification)
    .set({ documentKey: key, documentFilename: file.name, updatedBy: actorId })
    .where(eq(s.certification.id, certId));
  await logActivity(db, { actorId, action: "certification.document.upload", entity: "certification", entityId: certId });

  return NextResponse.json({ ok: true, filename: file.name });
}

/** Download a certificate document through an authorised, scope-checked route. */
export async function GET(req: Request, ctx: { params: Promise<{ certId: string }> }) {
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { certId } = await ctx.params;
  const db = getDb();
  const [cert] = await db
    .select({ key: s.certification.documentKey, filename: s.certification.documentFilename, personId: s.certification.personId })
    .from(s.certification)
    .where(eq(s.certification.id, certId))
    .limit(1);
  if (!cert?.key) return NextResponse.json({ error: "No document on file." }, { status: 404 });

  // Scope: internal staff may view; a deployed officer may view only their own.
  if (!canAccessDocument(user, cert.personId)) {
    return NextResponse.json({ error: "Not permitted." }, { status: 403 });
  }

  const bytes = await getStorage().get(cert.key);
  if (!bytes) return NextResponse.json({ error: "Document unavailable." }, { status: 404 });

  const ext = cert.key.split(".").pop();
  const type = ext === "pdf" ? "application/pdf" : ext === "png" ? "image/png" : "image/jpeg";
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `inline; filename="${cert.filename ?? "certificate"}"`,
    },
  });
}
