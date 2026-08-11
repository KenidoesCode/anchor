import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/pg";
import * as s from "@/db/schema";
import { runGate, createAssignment } from "@/server/assignment-service";
import { getEscalationStages, getGateConfig, SETTING_KEYS } from "@/server/config";
import { seedGateWorld, type GateFixture } from "./helpers/fixtures";
import { makeTestDb } from "./helpers/test-db";

const ACTOR = s.SYSTEM_ACTOR_ID;
const TODAY = "2026-08-11";

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

async function setSetting(key: string, value: unknown) {
  await db.update(s.appSetting).set({ value }).where(eq(s.appSetting.key, key));
}

function input(personId: string, startDate: string, endDate: string | null) {
  return { personId, roleId: fx.roleWshoId, organisationId: fx.orgId, siteId: fx.siteId, startDate, endDate };
}

describe("Group-B rules are configuration, not constants (ADR-0017)", () => {
  it("ships the escalation stages as data, ordered — the cascade reads these", async () => {
    const stages = await getEscalationStages(db);
    // Assert against the CONFIG, not hardcoded numbers: whatever is configured
    // is what the cascade will use.
    expect(stages.map((x) => x.stageKey)).toEqual([...stages].sort((a, b) => a.sortOrder - b.sortOrder).map((x) => x.stageKey));
    expect(stages.length).toBeGreaterThan(0);
    for (const stage of stages) {
      expect(typeof stage.daysBefore).toBe("number");
      expect(["holder", "line_manager", "account_owner", "director"]).toContain(stage.notifyTarget);
    }
  });

  it("overlap blocking can be switched off in config with no code change", async () => {
    // Seed an existing deployment for the valid officer.
    await createAssignment(db, input(fx.validPersonId, "2026-09-01", "2026-12-31"), ACTOR, TODAY);

    // Default config: an overlapping second posting is blocked.
    const before = await runGate(db, { personId: fx.validPersonId, roleId: fx.roleWshoId, startDate: "2026-10-01", endDate: "2027-01-31" }, TODAY);
    expect(before.outcome).toBe("blocked");
    expect(before.reasons[0]?.code).toBe("overlap");

    // Flip the data — not the code.
    await setSetting(SETTING_KEYS.overlapEnabled, false);
    expect((await getGateConfig(db)).overlapEnabled).toBe(false);

    const after = await runGate(db, { personId: fx.validPersonId, roleId: fx.roleWshoId, startDate: "2026-10-01", endDate: "2027-01-31" }, TODAY);
    expect(after.outcome).toBe("confirmed");
  });

  it("overlap inclusivity is config: touching intervals overlap only when inclusive", async () => {
    // Existing posting ends 2026-09-30.
    await createAssignment(db, input(fx.validPersonId, "2026-06-01", "2026-09-30"), ACTOR, TODAY);
    const touching = { personId: fx.validPersonId, roleId: fx.roleWshoId, startDate: "2026-09-30", endDate: "2026-12-31" };

    // Inclusive (default): touching day counts as overlap → blocked.
    expect((await runGate(db, touching, TODAY)).outcome).toBe("blocked");

    // Exclusive: touching endpoints do not overlap → confirmed.
    await setSetting(SETTING_KEYS.overlapInclusive, false);
    expect((await runGate(db, touching, TODAY)).outcome).toBe("confirmed");
  });

  it("resolve-as-of is config: switching to deployment_start selects the version in force then", async () => {
    // A future requirement version takes effect 2026-10-01 requiring FSM instead.
    const [fsmType] = await db
      .insert(s.certificationType)
      .values({ code: "FSM", name: "FSM", authorityId: (await db.select({ id: s.authority.id }).from(s.authority).limit(1))[0]!.id })
      .returning({ id: s.certificationType.id });
    // Close v1 at 2026-09-30, open v2 from 2026-10-01 requiring FSM.
    await db.update(s.roleRequirementVersion).set({ validTo: "2026-09-30" }).where(eq(s.roleRequirementVersion.roleId, fx.roleWshoId));
    const [rv2] = await db
      .insert(s.roleRequirementVersion)
      .values({ roleId: fx.roleWshoId, versionNo: 2, validFrom: "2026-10-01" })
      .returning({ id: s.roleRequirementVersion.id });
    const [g2] = await db.insert(s.requirementGroup).values({ requirementVersionId: rv2!.id, combinator: "all_of" }).returning({ id: s.requirementGroup.id });
    await db.insert(s.requirementItem).values({ groupId: g2!.id, certificationTypeId: fsmType!.id });

    const q = { personId: fx.validPersonId, roleId: fx.roleWshoId, startDate: "2026-11-01", endDate: "2026-12-31" };

    // resolveAsOf='today' (2026-08-11): v1 (WSHO) in force → valid officer confirmed.
    expect((await runGate(db, q, TODAY)).outcome).toBe("confirmed");

    // resolveAsOf='deployment_start' (2026-11-01): v2 (FSM) in force → officer lacks FSM → blocked.
    await setSetting(SETTING_KEYS.resolveAsOf, "deployment_start");
    expect((await runGate(db, q, TODAY)).outcome).toBe("blocked");
  });
});
