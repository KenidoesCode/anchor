import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/pg";
import * as s from "@/db/schema";
import { encryptNric, decryptNric, maskNric } from "@/server/crypto";
import { runGate } from "@/server/assignment-service";
import { callerFor, fakeUser } from "./helpers/caller";
import { seedGateWorld, type GateFixture } from "./helpers/fixtures";
import { makeTestDb } from "./helpers/test-db";

let db: Db;
let close: () => Promise<void>;
let fx: GateFixture;

beforeEach(async () => {
  ({ db, close } = await makeTestDb());
  fx = await seedGateWorld(db);
});
afterEach(async () => {
  await close();
});

describe("national identifier protection (PRD §10.2)", () => {
  it("round-trips encryption and masks by default", () => {
    const enc = encryptNric("S1234567A");
    expect(enc.ciphertext).not.toContain("1234567");
    expect(decryptNric(enc.ciphertext)).toBe("S1234567A");
    expect(maskNric(enc.last4)).toBe("•••••567A");
  });

  it("person.get never returns the identifier; unmask is reason-required and logged", async () => {
    const admin = callerFor(db, fakeUser("training_admin"));
    const personId = await admin.person.create({ fullName: "Officer NRIC", nationalId: "S7654321Z" });

    const masked = await admin.person.get({ personId });
    expect(masked?.nationalIdMasked).toBe("•••••321Z");
    expect(JSON.stringify(masked)).not.toContain("S7654321Z");

    // Coordinator may not unmask.
    const coord = callerFor(db, fakeUser("deployment_coordinator"));
    await expect(coord.person.unmaskNationalId({ personId, reason: "checking" })).rejects.toMatchObject({ code: "FORBIDDEN" });

    // Admin may, with a reason; the value is returned and an audit row written (no value logged).
    const value = await admin.person.unmaskNationalId({ personId, reason: "SSG submission verification" });
    expect(value).toBe("S7654321Z");
    const [logRow] = await db.select().from(s.eventLog).where(eq(s.eventLog.action, "person.unmask_nric"));
    expect(logRow?.reason).toBe("SSG submission verification");
    expect(logRow?.detail ?? "").not.toContain("S7654321Z");
  });
});

describe("onboarding (F6) + registers (UXS §5.2/5.4)", () => {
  it("register sorts worst-status first, not alphabetically", async () => {
    const coord = callerFor(db, fakeUser("deployment_coordinator"));
    const people = await coord.register.people();
    // Fixture: Ng Siew Ling (valid, 2028) and R. Sundaram (lapsed). Lapsed must sort first.
    expect(people[0]?.fullName).toBe("R. Sundaram");
    expect(people[0]?.worstStatus).toBe("lapsed");
  });

  it("certifications board buckets by status", async () => {
    const coord = callerFor(db, fakeUser("deployment_coordinator"));
    const board = await coord.register.certifications();
    const sundaram = board.find((c) => c.personName === "R. Sundaram");
    expect(sundaram?.status).toBe("lapsed");
    expect(sundaram?.daysRemaining).toBeLessThan(0);
  });

  it("validates a certification's registration number against a configured pattern", async () => {
    const admin = callerFor(db, fakeUser("director"));
    const auth = await admin.admin.createAuthority({ code: "SCDF", name: "SCDF" });
    const ct = await admin.admin.createCertificationType({
      code: "FSM",
      name: "Fire Safety Manager",
      authorityId: auth!.id,
      validationPattern: "^FSM/\\d{2}/\\d{5}$",
    });
    const trainingAdmin = callerFor(db, fakeUser("training_admin"));
    const personId = await trainingAdmin.person.create({ fullName: "P" });
    await expect(
      trainingAdmin.person.addCertification({
        personId,
        certificationTypeId: ct!.id,
        registrationNumber: "not-a-valid-number",
        issueDate: "2024-01-01",
        expiryDate: "2027-01-01",
      }),
    ).rejects.toThrow(/format/);
  });
});

describe("admin: requirements are configuration (ADR-0002/0003)", () => {
  it("a new requirement version supersedes the old and is picked up by the gate", async () => {
    const admin = callerFor(db, fakeUser("director"));
    // New version from 2026-10-01 requiring FSM instead of WSHO.
    const fsm = await admin.admin.createCertificationType({
      code: "FSM",
      name: "FSM",
      authorityId: (await db.select({ id: s.authority.id }).from(s.authority).limit(1))[0]!.id,
    });
    await admin.admin.createRequirementVersion({
      roleId: fx.roleWshoId,
      validFrom: "2026-10-01",
      combinator: "all_of",
      itemCertificationTypeIds: [fsm!.id],
    });

    // Switch resolve-as-of to deployment_start so a Nov posting uses the new version.
    await db.update(s.appSetting).set({ value: "deployment_start" }).where(eq(s.appSetting.key, "gate.resolveAsOf"));
    const g = await runGate(db, { personId: fx.validPersonId, roleId: fx.roleWshoId, startDate: "2026-11-01", endDate: "2026-12-31" }, "2026-08-11");
    expect(g.outcome).toBe("blocked"); // holder has WSHO, not FSM
  });

  it("changing an escalation threshold is a data update via the admin API", async () => {
    const admin = callerFor(db, fakeUser("director"));
    await admin.admin.updateEscalationStage({ stageKey: "d60", daysBefore: 45 });
    const [stage] = await db.select().from(s.escalationStageConfig).where(eq(s.escalationStageConfig.stageKey, "d60"));
    expect(stage?.daysBefore).toBe(45);
  });
});
