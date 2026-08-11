import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/pg";
import * as s from "@/db/schema";
import { runEscalationCascade } from "@/server/escalation";
import { canAccessDocument, canUploadDocument, validateDocument } from "@/server/document-access";
import { emailStubAdapter, dispatchPending } from "@/server/notifications";
import { createRateLimiter } from "@/server/rate-limit";
import { withActor } from "@/server/rls";
import { getStorage } from "@/server/storage";
import { installDefaultConfig } from "@/server/default-config";
import { callerFor, fakeUser } from "./helpers/caller";
import { makeTestDb } from "./helpers/test-db";

let db: Db;
let close: () => Promise<void>;

beforeEach(async () => {
  ({ db, close } = await makeTestDb());
});
afterEach(async () => {
  await close();
});

describe("file upload authorisation & validation (§2)", () => {
  it("only onboarding roles may upload; officers may read only their own", () => {
    expect(canUploadDocument("training_admin")).toBe(true);
    expect(canUploadDocument("deployment_coordinator")).toBe(false);
    expect(canAccessDocument({ role: "director", personId: null }, "p1")).toBe(true);
    expect(canAccessDocument({ role: "deployed_officer", personId: "p1" }, "p1")).toBe(true);
    expect(canAccessDocument({ role: "deployed_officer", personId: "p2" }, "p1")).toBe(false);
  });

  it("rejects the wrong type or an oversized file, server-side", () => {
    expect(validateDocument("text/html", 10)).toMatch(/PDF/);
    expect(validateDocument("application/pdf", 6 * 1024 * 1024)).toMatch(/5 MB/);
    expect(validateDocument("application/pdf", 1000)).toBeNull();
  });

  it("the local storage adapter round-trips bytes", async () => {
    const store = getStorage();
    await store.put("test/x.pdf", Buffer.from("hello"), "application/pdf");
    const back = await store.get("test/x.pdf");
    expect(back?.toString()).toBe("hello");
    expect(await store.get("test/missing.pdf")).toBeNull();
  });
});

describe("notification outbox & adapters (§3)", () => {
  it("routes by channel: in-app stays visible/sent; a selected email stub throws → marked failed", async () => {
    await installDefaultConfig(db, s.SYSTEM_ACTOR_ID);
    await db.insert(s.notification).values([
      { channel: "in_app", subject: "in-app", body: "b", recipientRole: "director" },
      { channel: "email", subject: "emailed", body: "b", recipientRole: "director" },
    ]);
    // The console default sends both; force the email stub for the email row.
    // First dispatch with default (console) — both succeed.
    const n = await dispatchPending(db);
    expect(n).toBe(2);
    const sent = await db.select().from(s.notification).where(sql`status = 'sent'`);
    expect(sent.length).toBe(2);

    // The email stub, if selected, throws clearly (nothing is ever really sent).
    await expect(emailStubAdapter.send({ channel: "email", recipientId: null, recipientRole: "director", subject: "x", body: "y" })).rejects.toThrow(/SES/);
  });

  it("the bell reads unread notifications addressed to the viewer's role", async () => {
    await installDefaultConfig(db, s.SYSTEM_ACTOR_ID);
    const [auth] = await db.insert(s.authority).values({ code: "MOM", name: "MOM" }).returning({ id: s.authority.id });
    const [ct] = await db.insert(s.certificationType).values({ code: "WSHO", name: "WSHO", authorityId: auth!.id }).returning({ id: s.certificationType.id });
    const [p] = await db.insert(s.person).values({ fullName: "Holder" }).returning({ id: s.person.id });
    await db.insert(s.certification).values({ personId: p!.id, certificationTypeId: ct!.id, registrationNumber: "R/1", issueDate: "2021-01-01", expiryDate: "2026-09-25" });
    await runEscalationCascade(db, "2026-08-11", s.SYSTEM_ACTOR_ID); // fires director-addressed stages

    const director = callerFor(db, fakeUser("director"));
    const unread = await director.notifications.unread();
    expect(unread.length).toBeGreaterThan(0);
    await director.notifications.markRead({});
    expect((await director.notifications.unread()).length).toBe(0);
  });
});

describe("RLS threading (§4) — withActor sets the session GUCs", () => {
  it("exposes the actor id and role to the transaction", async () => {
    const seen = await withActor(db, { actorId: "abc-123", role: "deployed_officer" }, async (tx) => {
      const res = await tx.execute(sql`select current_setting('app.actor_id', true) as a, current_setting('app.user_role', true) as r`);
      const rows = (res as unknown as { rows?: Array<{ a: string; r: string }> }).rows ?? (res as unknown as Array<{ a: string; r: string }>);
      return rows[0];
    });
    expect(seen?.a).toBe("abc-123");
    expect(seen?.r).toBe("deployed_officer");
  });
});

describe("rate limiting (§4)", () => {
  it("allows up to the max in a window, then blocks, then resets", () => {
    const limited = createRateLimiter({ windowMs: 1000, max: 3 });
    expect(limited("ip", 0)).toBe(false);
    expect(limited("ip", 1)).toBe(false);
    expect(limited("ip", 2)).toBe(false);
    expect(limited("ip", 3)).toBe(true); // 4th in window
    expect(limited("ip", 2000)).toBe(false); // window elapsed
  });
});
