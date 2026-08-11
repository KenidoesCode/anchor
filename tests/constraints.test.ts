import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/pg";
import * as s from "@/db/schema";
import { makeTestDb } from "./helpers/test-db";

let db: Db;
let close: () => Promise<void>;

beforeEach(async () => {
  ({ db, close } = await makeTestDb());
});
afterEach(async () => {
  await close();
});

async function seedRoleAndType() {
  const [auth] = await db
    .insert(s.authority)
    .values({ code: "MOM", name: "MOM" })
    .returning({ id: s.authority.id });
  const [ct] = await db
    .insert(s.certificationType)
    .values({ code: "WSHO", name: "WSHO", authorityId: auth!.id })
    .returning({ id: s.certificationType.id });
  const [role] = await db
    .insert(s.role)
    .values({ code: "WSHO", name: "WSHO" })
    .returning({ id: s.role.id });
  return { certTypeId: ct!.id, roleId: role!.id };
}

describe("foreign keys — the six converted columns reject dangling references", () => {
  it("person.line_manager_id must reference a real person", async () => {
    await expect(
      db.insert(s.person).values({ fullName: "X", lineManagerId: randomUUID() }),
    ).rejects.toThrow();
  });

  it("organisation.account_owner_id must reference a real person", async () => {
    await expect(
      db.insert(s.organisation).values({ name: "Org", accountOwnerId: randomUUID() }),
    ).rejects.toThrow();
  });

  it("certification.supersedes_certification_id must reference a real certification", async () => {
    const { certTypeId } = await seedRoleAndType();
    const [p] = await db.insert(s.person).values({ fullName: "P" }).returning({ id: s.person.id });
    await expect(
      db.insert(s.certification).values({
        personId: p!.id,
        certificationTypeId: certTypeId,
        registrationNumber: "R/1",
        issueDate: "2020-01-01",
        expiryDate: "2030-01-01",
        supersedesCertificationId: randomUUID(),
      }),
    ).rejects.toThrow();
  });

  it("requirement_group.parent_group_id must reference a real group", async () => {
    const { roleId } = await seedRoleAndType();
    const [rv] = await db
      .insert(s.roleRequirementVersion)
      .values({ roleId, versionNo: 1, validFrom: "2000-01-01" })
      .returning({ id: s.roleRequirementVersion.id });
    await expect(
      db.insert(s.requirementGroup).values({
        requirementVersionId: rv!.id,
        combinator: "all_of",
        parentGroupId: randomUUID(),
      }),
    ).rejects.toThrow();
  });
});

describe("renewal_task CHECK — a closed task must carry its closing certificate (ADR-0008)", () => {
  async function aCertificate(): Promise<{ certId: string; personId: string }> {
    const { certTypeId } = await seedRoleAndType();
    const [p] = await db.insert(s.person).values({ fullName: "P" }).returning({ id: s.person.id });
    const [c] = await db
      .insert(s.certification)
      .values({
        personId: p!.id,
        certificationTypeId: certTypeId,
        registrationNumber: "R/1",
        issueDate: "2020-01-01",
        expiryDate: "2026-07-31",
      })
      .returning({ id: s.certification.id });
    return { certId: c!.id, personId: p!.id };
  }

  it("rejects status='closed' with a null closing certificate", async () => {
    const { certId, personId } = await aCertificate();
    await expect(
      db.insert(s.renewalTask).values({
        certificationId: certId,
        personId,
        dueDate: "2026-07-31",
        source: "cascade_90d",
        status: "closed",
        closedByCertificationId: null,
      }),
    ).rejects.toThrow();
  });

  it("allows an open task with no closing certificate", async () => {
    const { certId, personId } = await aCertificate();
    await expect(
      db.insert(s.renewalTask).values({
        certificationId: certId,
        personId,
        dueDate: "2026-07-31",
        source: "cascade_90d",
        status: "open",
      }),
    ).resolves.toBeDefined();
  });
});

describe("requirement-version invariants (ADR-0002)", () => {
  it("partial unique index: a role may have only one current (open) version", async () => {
    const { roleId } = await seedRoleAndType();
    await db
      .insert(s.roleRequirementVersion)
      .values({ roleId, versionNo: 1, validFrom: "2000-01-01", validTo: null });
    await expect(
      db
        .insert(s.roleRequirementVersion)
        .values({ roleId, versionNo: 2, validFrom: "2026-07-01", validTo: null }),
    ).rejects.toThrow();
  });

  it("non-overlap trigger: overlapping validity ranges are rejected", async () => {
    const { roleId } = await seedRoleAndType();
    await db
      .insert(s.roleRequirementVersion)
      .values({ roleId, versionNo: 1, validFrom: "2000-01-01", validTo: "2026-06-30" });
    await expect(
      db
        .insert(s.roleRequirementVersion)
        .values({ roleId, versionNo: 2, validFrom: "2026-06-15", validTo: "2027-01-01" }),
    ).rejects.toThrow();
  });

  it("non-overlap trigger: a clean supersession (adjacent, non-touching) is allowed", async () => {
    const { roleId } = await seedRoleAndType();
    await db
      .insert(s.roleRequirementVersion)
      .values({ roleId, versionNo: 1, validFrom: "2000-01-01", validTo: "2026-06-30" });
    await expect(
      db
        .insert(s.roleRequirementVersion)
        .values({ roleId, versionNo: 2, validFrom: "2026-07-01", validTo: null }),
    ).resolves.toBeDefined();
  });
});

describe("requirement-version content immutability once pinned (ADR-0002/0003)", () => {
  async function versionWithItem() {
    const { roleId, certTypeId } = await seedRoleAndType();
    const [rv] = await db
      .insert(s.roleRequirementVersion)
      .values({ roleId, versionNo: 1, validFrom: "2000-01-01" })
      .returning({ id: s.roleRequirementVersion.id });
    const [g] = await db
      .insert(s.requirementGroup)
      .values({ requirementVersionId: rv!.id, combinator: "all_of" })
      .returning({ id: s.requirementGroup.id });
    const [item] = await db
      .insert(s.requirementItem)
      .values({ groupId: g!.id, certificationTypeId: certTypeId })
      .returning({ id: s.requirementItem.id });
    return { roleId, rvId: rv!.id, groupId: g!.id, itemId: item!.id };
  }

  it("allows editing a version's contents while it is not yet pinned", async () => {
    const { groupId } = await versionWithItem();
    await expect(
      db
        .update(s.requirementGroup)
        .set({ sort: 5 })
        .where(sql`id = ${groupId}`),
    ).resolves.toBeDefined();
  });

  it("blocks editing a group once an assignment pins the version", async () => {
    const { roleId, rvId, groupId } = await versionWithItem();
    const [p] = await db.insert(s.person).values({ fullName: "P" }).returning({ id: s.person.id });
    await db.insert(s.assignment).values({
      personId: p!.id,
      roleId,
      requirementVersionId: rvId,
      outcome: "confirmed",
      validatedBy: s.SYSTEM_ACTOR_ID,
    });
    await expect(
      db
        .update(s.requirementGroup)
        .set({ sort: 9 })
        .where(sql`id = ${groupId}`),
    ).rejects.toThrow(/immutable/);
  });

  it("blocks editing an item once an assignment pins the version", async () => {
    const { roleId, rvId, itemId } = await versionWithItem();
    const [p] = await db.insert(s.person).values({ fullName: "P" }).returning({ id: s.person.id });
    await db.insert(s.assignment).values({
      personId: p!.id,
      roleId,
      requirementVersionId: rvId,
      outcome: "confirmed",
      validatedBy: s.SYSTEM_ACTOR_ID,
    });
    await expect(
      db
        .update(s.requirementItem)
        .set({ sort: 3 })
        .where(sql`id = ${itemId}`),
    ).rejects.toThrow(/immutable/);
  });
});
