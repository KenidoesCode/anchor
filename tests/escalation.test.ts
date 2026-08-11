import { and, eq, isNull } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/pg";
import * as s from "@/db/schema";
import { getEscalationStages } from "@/server/config";
import { installDefaultConfig } from "@/server/default-config";
import { daysBetween } from "@/domain/gate";
import { runEscalationCascade } from "@/server/escalation";
import { dispatchPending } from "@/server/notifications";
import { makeTestDb } from "./helpers/test-db";

const ACTOR = s.SYSTEM_ACTOR_ID;
const NOW = "2026-08-11";

let db: Db;
let close: () => Promise<void>;
let momId: string;
let wshoTypeId: string;

beforeEach(async () => {
  ({ db, close } = await makeTestDb());
  await installDefaultConfig(db, ACTOR);
  const [a] = await db.insert(s.authority).values({ code: "MOM", name: "MOM" }).returning({ id: s.authority.id });
  momId = a!.id;
  const [ct] = await db
    .insert(s.certificationType)
    .values({ code: "WSHO", name: "WSHO", authorityId: momId })
    .returning({ id: s.certificationType.id });
  wshoTypeId = ct!.id;
});
afterEach(async () => {
  await close();
});

async function personWithCert(name: string, expiryDate: string, managerId?: string) {
  const [p] = await db.insert(s.person).values({ fullName: name, lineManagerId: managerId ?? null }).returning({ id: s.person.id });
  const [c] = await db
    .insert(s.certification)
    .values({
      personId: p!.id,
      certificationTypeId: wshoTypeId,
      registrationNumber: `WSHO/24/${name.length}`,
      issueDate: "2021-01-01",
      expiryDate,
    })
    .returning({ id: s.certification.id });
  return { personId: p!.id, certId: c!.id };
}

/** Days-until → the set of stage keys the CONFIG says should fire (not hardcoded). */
async function expectedStagesFor(expiryDate: string): Promise<string[]> {
  const stages = await getEscalationStages(db);
  const daysUntil = daysBetween(NOW, expiryDate);
  return stages
    .filter((st) => daysUntil <= st.daysBefore)
    .map((st) => st.stageKey)
    .sort();
}

async function firedStages(certId: string): Promise<string[]> {
  const rows = await db
    .select({ stage: s.escalationEvent.stage })
    .from(s.escalationEvent)
    .where(eq(s.escalationEvent.certificationId, certId));
  return rows.map((r) => r.stage).sort();
}

describe("escalation cascade (config-driven, ADR-0017 / ADR-0004)", () => {
  it("fires exactly the stages the config says, for a cert 45 days from expiry", async () => {
    const [mgr] = await db.insert(s.person).values({ fullName: "Manager" }).returning({ id: s.person.id });
    const { certId } = await personWithCert("Faizal", "2026-09-25", mgr!.id); // 45 days out

    await runEscalationCascade(db, NOW, ACTOR);

    expect(await firedStages(certId)).toEqual(await expectedStagesFor("2026-09-25"));
  });

  it("is idempotent — a second run fires nothing (unique constraint)", async () => {
    await personWithCert("Faizal", "2026-09-25");
    const first = await runEscalationCascade(db, NOW, ACTOR);
    const second = await runEscalationCascade(db, NOW, ACTOR);
    expect(first.fired).toBeGreaterThan(0);
    expect(second.fired).toBe(0);
  });

  it("opens exactly one renewal task at the widest (90-day) stage", async () => {
    const { certId } = await personWithCert("Faizal", "2026-09-25");
    await runEscalationCascade(db, NOW, ACTOR);
    await runEscalationCascade(db, NOW, ACTOR); // must not create a second
    const tasks = await db
      .select()
      .from(s.renewalTask)
      .where(and(eq(s.renewalTask.certificationId, certId), isNull(s.renewalTask.deletedAt)));
    expect(tasks.length).toBe(1);
    expect(tasks[0]?.source).toBe("cascade_90d");
  });

  it("resolves recipients from config, with Director fallback when a relationship is null", async () => {
    const [mgr] = await db.insert(s.person).values({ fullName: "Manager" }).returning({ id: s.person.id });
    const withMgr = await personWithCert("HasManager", "2026-09-25", mgr!.id);
    const noMgr = await personWithCert("NoManager", "2026-09-25");

    await runEscalationCascade(db, NOW, ACTOR);

    // d60 stage notifies line_manager (per default config).
    const d60 = (await getEscalationStages(db)).find((x) => x.stageKey === "d60");
    expect(d60?.notifyTarget).toBe("line_manager");

    const [withMgrEvent] = await db
      .select({ recipientId: s.escalationEvent.recipientId, recipientRole: s.escalationEvent.recipientRole })
      .from(s.escalationEvent)
      .where(and(eq(s.escalationEvent.certificationId, withMgr.certId), eq(s.escalationEvent.stage, "d60")));
    expect(withMgrEvent?.recipientId).toBe(mgr!.id);
    expect(withMgrEvent?.recipientRole).toBe("line_manager");

    const [noMgrEvent] = await db
      .select({ recipientId: s.escalationEvent.recipientId, recipientRole: s.escalationEvent.recipientRole })
      .from(s.escalationEvent)
      .where(and(eq(s.escalationEvent.certificationId, noMgr.certId), eq(s.escalationEvent.stage, "d60")));
    expect(noMgrEvent?.recipientRole).toBe("director"); // fallback
    expect(noMgrEvent?.recipientId).toBeNull();
  });

  it("writes notifications to the outbox and the console adapter marks them sent", async () => {
    await personWithCert("Faizal", "2026-09-25");
    await runEscalationCascade(db, NOW, ACTOR);
    const pendingBefore = await db.select().from(s.notification).where(eq(s.notification.status, "pending"));
    expect(pendingBefore.length).toBeGreaterThan(0);

    const dispatched = await dispatchPending(db);
    expect(dispatched).toBe(pendingBefore.length);
    const stillPending = await db.select().from(s.notification).where(eq(s.notification.status, "pending"));
    expect(stillPending.length).toBe(0);
  });

  it("reflects a config change: shortening a stage's window changes what fires", async () => {
    const { certId } = await personWithCert("Faizal", "2026-09-25"); // 45 days out
    // Move the 60-day stage in to 40 days — now it should NOT fire at 45 days out.
    await db.update(s.escalationStageConfig).set({ daysBefore: 40 }).where(eq(s.escalationStageConfig.stageKey, "d60"));
    await runEscalationCascade(db, NOW, ACTOR);
    expect(await firedStages(certId)).toEqual(await expectedStagesFor("2026-09-25"));
    expect(await firedStages(certId)).not.toContain("d60");
  });
});
