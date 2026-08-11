import { and, eq, isNull } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/pg";
import * as s from "@/db/schema";
import { runGate } from "@/server/assignment-service";
import { runEscalationCascade } from "@/server/escalation";
import { closeRenewalTask, RenewalError } from "@/server/renewal-service";
import { overviewTiles } from "@/server/reporting";
import { callerFor, fakeUser } from "./helpers/caller";
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

function input(personId: string, endDate: string | null = "2026-12-31") {
  return { personId, roleId: fx.roleWshoId, organisationId: fx.orgId, siteId: fx.siteId, startDate: "2026-09-01", endDate };
}

describe("renewal closing procedure (ADR-0008)", () => {
  async function openTaskFor(personId: string, certExpiry: string): Promise<string> {
    // Give the person a cert expiring soon, then let the cascade open the task.
    await db.insert(s.certification).values({
      personId,
      certificationTypeId: fx.wshoTypeId,
      registrationNumber: "WSHO/OLD/1",
      issueDate: "2021-01-01",
      expiryDate: certExpiry,
    });
    await runEscalationCascade(db, TODAY, ACTOR);
    const [task] = await db
      .select({ id: s.renewalTask.id })
      .from(s.renewalTask)
      .innerJoin(s.certification, eq(s.renewalTask.certificationId, s.certification.id))
      .where(and(eq(s.renewalTask.personId, personId), eq(s.certification.registrationNumber, "WSHO/OLD/1")));
    return task!.id;
  }

  it("closes only on a later-dated certificate; supersedes and soft-deletes the old", async () => {
    const [p] = await db.insert(s.person).values({ fullName: "Renewer" }).returning({ id: s.person.id });
    const taskId = await openTaskFor(p!.id, "2026-09-25");

    const { newCertificationId } = await closeRenewalTask(
      db,
      taskId,
      { registrationNumber: "WSHO/NEW/1", issueDate: "2026-09-01", expiryDate: "2029-09-01" },
      ACTOR,
      TODAY,
    );

    const [task] = await db.select().from(s.renewalTask).where(eq(s.renewalTask.id, taskId));
    expect(task?.status).toBe("closed");
    expect(task?.closedByCertificationId).toBe(newCertificationId);

    const [newCert] = await db.select().from(s.certification).where(eq(s.certification.id, newCertificationId));
    expect(newCert?.supersedesCertificationId).toBeTruthy();

    // Old cert is retained but soft-deleted (out of the live pool).
    const [oldCert] = await db
      .select()
      .from(s.certification)
      .where(eq(s.certification.id, task!.certificationId));
    expect(oldCert?.deletedAt).not.toBeNull();
  });

  it("rejects a renewal whose expiry is not later than the current one", async () => {
    const [p] = await db.insert(s.person).values({ fullName: "Renewer2" }).returning({ id: s.person.id });
    const taskId = await openTaskFor(p!.id, "2026-09-25");
    await expect(
      closeRenewalTask(
        db,
        taskId,
        { registrationNumber: "WSHO/NEW/2", issueDate: "2026-09-01", expiryDate: "2026-09-25" },
        ACTOR,
        TODAY,
      ),
    ).rejects.toBeInstanceOf(RenewalError);
  });
});

describe("Director override (F1 §3.2, AC1.5)", () => {
  it("only a Director may override, and it produces outcome=overridden + an open override", async () => {
    const coord = callerFor(db, fakeUser("deployment_coordinator"));
    await expect(
      coord.override.approve({ assignment: input(fx.lapsedPersonId), justification: "Emergency cover, agreed with client." }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const director = callerFor(db, fakeUser("director"));
    const res = await director.override.approve({
      assignment: input(fx.lapsedPersonId),
      justification: "Emergency cover authorised; renewal in progress.",
    });

    const [a] = await db.select().from(s.assignment).where(eq(s.assignment.id, res.assignmentId));
    expect(a?.outcome).toBe("overridden");
    expect(a?.overrideId).toBe(res.overrideId);

    const [ov] = await db.select().from(s.overrideRecord).where(eq(s.overrideRecord.id, res.overrideId));
    expect(ov?.status).toBe("open");

    // AC1.5: attributable with justification in the immutable log.
    const [logRow] = await db
      .select()
      .from(s.eventLog)
      .where(eq(s.eventLog.action, "assignment.override"));
    expect(logRow?.reason).toContain("Emergency cover authorised");
  });

  it("rejects an override with no real justification", async () => {
    const director = callerFor(db, fakeUser("director"));
    await expect(
      director.override.approve({ assignment: input(fx.lapsedPersonId), justification: "no" }),
    ).rejects.toBeDefined();
  });

  it("refuses to override an assignment that is not blocked", async () => {
    const director = callerFor(db, fakeUser("director"));
    await expect(
      director.override.approve({ assignment: input(fx.validPersonId), justification: "not needed at all here" }),
    ).rejects.toBeDefined();
  });
});

describe("Director Overview tiles (ADR-0006)", () => {
  it("counts expiring-within-90 and open overrides; lapsed-among-deployed is bitemporal", async () => {
    // valid person's cert (2028) and lapsed person's cert (2026-07-31) exist.
    const before = await overviewTiles(db, TODAY);
    expect(before.openOverrides).toBe(0);

    // Override the lapsed person onto a site, ACTIVE on TODAY (start in the past),
    // → now genuinely deployed under a lapsed cert as of the queried date.
    const director = callerFor(db, fakeUser("director"));
    await director.override.approve({
      assignment: {
        personId: fx.lapsedPersonId,
        roleId: fx.roleWshoId,
        organisationId: fx.orgId,
        siteId: fx.siteId,
        startDate: "2026-08-01",
        endDate: "2026-12-31",
      },
      justification: "Authorised emergency cover for audit.",
    });

    const after = await overviewTiles(db, TODAY);
    expect(after.openOverrides).toBe(1);
    expect(after.lapsedAmongDeployed).toBe(1);

    // Also confirm the gate would still block a fresh attempt (override didn't relax it).
    const g = await runGate(db, { personId: fx.lapsedPersonId, roleId: fx.roleWshoId, startDate: "2027-01-01", endDate: "2027-06-30" }, TODAY);
    expect(g.outcome).toBe("blocked");
  });
});
