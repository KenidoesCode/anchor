import { NextResponse } from "next/server";
import { getDb } from "@/db/pg";
import { authenticate, createSession, SESSION_COOKIE } from "@/server/auth";
import { logActivity } from "@/server/activity";
import { actorIdOf } from "@/server/auth";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { email?: string; password?: string }
    | null;
  if (!body?.email || !body?.password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const db = getDb();
  const user = await authenticate(db, body.email, body.password);
  if (!user) {
    // Never reveal which half was wrong; never log the password.
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }

  const token = await createSession(db, user.id);
  await logActivity(db, { actorId: actorIdOf(user), action: "auth.signin", entity: "app_user", entityId: user.id });

  const res = NextResponse.json({ user: { email: user.email, fullName: user.fullName, role: user.role } });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 12 * 60 * 60,
  });
  return res;
}
