import { and, desc, eq, isNull } from "drizzle-orm";
import type { Db } from "@/db/pg";
import * as s from "@/db/schema";
import { logActivity } from "./activity";

function addDaysIso(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Create a new effective-dated requirement version for a role (ADR-0002/0003),
 * closing the previous current version the day before. This is the admin path
 * that makes "certification requirements are configuration" real: a requirement
 * change is a new version, never an in-place edit of a pinned one.
 */
export async function createRequirementVersion(
  db: Db,
  input: { roleId: string; validFrom: string; combinator: "all_of" | "any_of"; itemCertificationTypeIds: string[] },
  actorId: string,
): Promise<string> {
  return db.transaction(async (tx) => {
    const current = await tx
      .select({ id: s.roleRequirementVersion.id, versionNo: s.roleRequirementVersion.versionNo })
      .from(s.roleRequirementVersion)
      .where(
        and(
          eq(s.roleRequirementVersion.roleId, input.roleId),
          isNull(s.roleRequirementVersion.validTo),
          isNull(s.roleRequirementVersion.deletedAt),
        ),
      )
      .limit(1);

    if (current[0]) {
      await tx
        .update(s.roleRequirementVersion)
        .set({ validTo: addDaysIso(input.validFrom, -1), updatedBy: actorId })
        .where(eq(s.roleRequirementVersion.id, current[0].id));
    }

    const [latest] = await tx
      .select({ versionNo: s.roleRequirementVersion.versionNo })
      .from(s.roleRequirementVersion)
      .where(eq(s.roleRequirementVersion.roleId, input.roleId))
      .orderBy(desc(s.roleRequirementVersion.versionNo))
      .limit(1);
    const versionNo = (latest?.versionNo ?? 0) + 1;

    const [rv] = await tx
      .insert(s.roleRequirementVersion)
      .values({ roleId: input.roleId, versionNo, validFrom: input.validFrom, createdBy: actorId, updatedBy: actorId })
      .returning({ id: s.roleRequirementVersion.id });

    const [group] = await tx
      .insert(s.requirementGroup)
      .values({ requirementVersionId: rv!.id, combinator: input.combinator, createdBy: actorId, updatedBy: actorId })
      .returning({ id: s.requirementGroup.id });

    for (const typeId of input.itemCertificationTypeIds) {
      await tx.insert(s.requirementItem).values({ groupId: group!.id, certificationTypeId: typeId, createdBy: actorId, updatedBy: actorId });
    }

    await logActivity(tx, { actorId, action: "requirement.version.create", entity: "role_requirement_version", entityId: rv!.id, detail: `role=${input.roleId} v${versionNo}` });
    return rv!.id;
  });
}
