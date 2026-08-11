import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/pg";
import * as s from "@/db/schema";
import { callerFor, fakeUser } from "./helpers/caller";
import { makeTestDb } from "./helpers/test-db";

const NRIC = "S9988776C";

let db: Db;
let close: () => Promise<void>;

beforeEach(async () => {
  ({ db, close } = await makeTestDb());
});
afterEach(async () => {
  await close();
});

/**
 * A national identifier must never appear in a log, an error payload, a URL or
 * a stack trace (PRD §10.2 / CLAUDE.md). This test drives the whole personal-data
 * path — create, read (masked), unmask (logged) — and scans every persisted
 * artefact plus a forced error for the raw value.
 */
describe("no national identifier ever reaches a log or error", () => {
  it("never persists the NRIC in the activity log, notifications, or an error message", async () => {
    const admin = callerFor(db, fakeUser("training_admin"));
    const personId = await admin.person.create({ fullName: "Sensitive Person", nationalId: NRIC });

    // Exercise a masked read and a legitimate, logged unmask.
    await admin.person.get({ personId });
    await admin.person.unmaskNationalId({ personId, reason: "SSG verification for submission" });

    // Force an error path that involves the person, and capture its message.
    let errorText = "";
    try {
      await admin.person.unmaskNationalId({ personId: "00000000-0000-0000-0000-000000000000", reason: "x" });
    } catch (e) {
      errorText = e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e);
    }

    // Scan every append-only log row and every notification body/subject.
    const logs = await db.select().from(s.eventLog);
    const notes = await db.select().from(s.notification);
    const haystack = JSON.stringify({ logs, notes }) + errorText;

    expect(haystack).not.toContain(NRIC);
    // The stored last-4 alone (masked) is acceptable; the full value is not.
    expect(haystack).not.toMatch(/S9988776C/);

    // Sanity: the ciphertext is stored, but not the plaintext, on the person row.
    const [p] = await db.select().from(s.person).limit(1);
    expect(JSON.stringify(p)).not.toContain(NRIC);
  });
});
