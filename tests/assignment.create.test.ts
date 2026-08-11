import { eq, isNull } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/pg";
import * as s from "@/db/schema";
import {
  AssignmentBlockedError,
  createAssignment,
  validateAssignment,
} from "@/server/assignment-service";
import type { AssignmentInput } from "@/schemas/assignment";
import { makeTestDb } from "./helpers/test-db";

const ACTOR = s.SYSTEM_ACTOR_ID;
const TODAY = "2026-08-11";

let db: Db;
let close: () => Promise<void>;

/** Fixtures shared across the suite. */
let ctWshoId: string;
let roleWshoId: string;
let orgId: string;
let siteId: string;
let validPersonId: string; // WSHO valid to 2028-02-28
let lapsedPersonId: string; // WSHO lapsed 2026-07-31

beforeEach(async () => {
  ({ db, close } = await makeTestDb());

  const [authority] = await db
    .insert(s.authority)
    .values({ code: "MOM", name: "Ministry of Manpower" })
    .returning({ id: s.authority.id });

  const [ct] = await db
    .insert(s.certificationType)
    .values({ code: "WSHO", name: "Workplace Safety & Health Officer", authorityId: authority!.id })
    .returning({ id: s.certificationType.id });
  ctWshoId = ct!.id;

  const [role] = await db
    .insert(s.role)
    .values({ code: "WSHO", name: "Workplace Safety & Health Officer" })
    .returning({ id: s.role.id });
  roleWshoId = role!.id;

  const [rv] = await db
    .insert(s.roleRequirementVersion)
    .values({ roleId: roleWshoId, versionNo: 1, validFrom: "2000-01-01", validTo: null })
    .returning({ id: s.roleRequirementVersion.id });

  const [group] = await db
    .insert(s.requirementGroup)
    .values({ requirementVersionId: rv!.id, combinator: "all_of", parentGroupId: null })
    .returning({ id: s.requirementGroup.id });

  await db
    .insert(s.requirementItem)
    .values({ groupId: group!.id, certificationTypeId: ctWshoId });

  const [org] = await db
    .insert(s.organisation)
    .values({ name: "Shimizu Corporation" })
    .returning({ id: s.organisation.id });
  orgId = org!.id;

  const [site] = await db
    .insert(s.site)
    .values({ organisationId: orgId, name: "Changi T5" })
    .returning({ id: s.site.id });
  siteId = site!.id;

  // Valid officer.
  const [valid] = await db
    .insert(s.person)
    .values({ fullName: "Ng Siew Ling" })
    .returning({ id: s.person.id });
  validPersonId = valid!.id;
  await db.insert(s.certification).values({
    personId: validPersonId,
    certificationTypeId: ctWshoId,
    registrationNumber: "WSHO/26/01204",
    issueDate: "2023-03-01",
    expiryDate: "2028-02-28",
  });

  // Lapsed officer.
  const [lapsed] = await db
    .insert(s.person)
    .values({ fullName: "R. Sundaram" })
    .returning({ id: s.person.id });
  lapsedPersonId = lapsed!.id;
  await db.insert(s.certification).values({
    personId: lapsedPersonId,
    certificationTypeId: ctWshoId,
    registrationNumber: "WSHO/24/08812",
    issueDate: "2021-08-01",
    expiryDate: "2026-07-31",
  });
});

afterEach(async () => {
  await close();
});

function input(overrides: Partial<AssignmentInput> & { personId: string }): AssignmentInput {
  return {
    roleId: roleWshoId,
    organisationId: orgId,
    siteId,
    startDate: "2026-09-01",
    endDate: "2026-12-31",
    ...overrides,
  };
}

async function deploymentCount(database: Db): Promise<number> {
  const rows = await database
    .select({ id: s.deployment.id })
    .from(s.deployment)
    .where(isNull(s.deployment.deletedAt));
  return rows.length;
}

describe("assignment gate — integration against real migrations", () => {
  it("validate() confirms a valid officer covering the full period", async () => {
    const r = await validateAssignment(db, input({ personId: validPersonId }), TODAY);
    expect(r.outcome).toBe("confirmed");
  });

  it("validate() blocks a lapsed officer", async () => {
    const r = await validateAssignment(db, input({ personId: lapsedPersonId }), TODAY);
    expect(r.outcome).toBe("blocked");
    expect(r.reasons[0]?.code).toBe("lapsed");
  });

  // The founding acceptance test (AC1.1): a blocked assignment cannot be
  // persisted through the API, not merely hidden in the UI.
  it("create() REJECTS a lapsed assignment and writes no deployment", async () => {
    await expect(
      createAssignment(db, input({ personId: lapsedPersonId }), ACTOR, TODAY),
    ).rejects.toBeInstanceOf(AssignmentBlockedError);
    expect(await deploymentCount(db)).toBe(0);
  });

  it("create() persists a confirmed assignment with its 1:1 deployment", async () => {
    const created = await createAssignment(db, input({ personId: validPersonId }), ACTOR, TODAY);
    expect(created.result.outcome).toBe("confirmed");

    const [a] = await db
      .select({ outcome: s.assignment.outcome })
      .from(s.assignment)
      .where(eq(s.assignment.id, created.assignmentId));
    expect(a?.outcome).toBe("confirmed");

    const [d] = await db
      .select({ assignmentId: s.deployment.assignmentId })
      .from(s.deployment)
      .where(eq(s.deployment.id, created.deploymentId));
    expect(d?.assignmentId).toBe(created.assignmentId);
    expect(await deploymentCount(db)).toBe(1);
  });

  it("create() persists a conditional assignment when the cert expires before the end", async () => {
    const created = await createAssignment(
      db,
      input({ personId: validPersonId, endDate: "2029-01-01" }),
      ACTOR,
      TODAY,
    );
    expect(created.result.outcome).toBe("conditional");
    const [a] = await db
      .select({ outcome: s.assignment.outcome })
      .from(s.assignment)
      .where(eq(s.assignment.id, created.assignmentId));
    expect(a?.outcome).toBe("conditional");
  });

  it("blocks a second overlapping deployment for the same officer", async () => {
    await createAssignment(db, input({ personId: validPersonId }), ACTOR, TODAY);
    const r = await validateAssignment(
      db,
      input({ personId: validPersonId, startDate: "2026-10-01", endDate: "2027-01-31" }),
      TODAY,
    );
    expect(r.outcome).toBe("blocked");
    expect(r.reasons[0]?.code).toBe("overlap");
  });

  it("pins the requirement version in force on the assignment (ADR-0002)", async () => {
    const created = await createAssignment(db, input({ personId: validPersonId }), ACTOR, TODAY);
    const [a] = await db
      .select({ rv: s.assignment.requirementVersionId })
      .from(s.assignment)
      .where(eq(s.assignment.id, created.assignmentId));
    expect(a?.rv).toEqual(created.result.requirementVersionId);
    expect(a?.rv).toBeTruthy();
  });
});
