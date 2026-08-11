import { and, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";
import type { Db } from "@/db/pg";
import * as s from "@/db/schema";
import type { RequirementNode } from "@/domain/gate";

export interface ResolvedRequirement {
  requirementVersionId: string;
  node: RequirementNode;
}

/**
 * Resolve the requirement version in force for a role on `asOf`, and build its
 * AND/OR node tree (ADR-0002 effective-dating, ADR-0003 composition).
 * Returns null if the role has no requirement configured for that date.
 */
export async function resolveRequirement(
  db: Db,
  roleId: string,
  asOf: string,
): Promise<ResolvedRequirement | null> {
  const version = await db
    .select()
    .from(s.roleRequirementVersion)
    .where(
      and(
        eq(s.roleRequirementVersion.roleId, roleId),
        isNull(s.roleRequirementVersion.deletedAt),
        lte(s.roleRequirementVersion.validFrom, asOf),
        or(
          isNull(s.roleRequirementVersion.validTo),
          gt(s.roleRequirementVersion.validTo, asOf),
        ),
      ),
    )
    .limit(1);

  const v = version[0];
  if (!v) return null;

  const groups = await db
    .select()
    .from(s.requirementGroup)
    .where(
      and(
        eq(s.requirementGroup.requirementVersionId, v.id),
        isNull(s.requirementGroup.deletedAt),
      ),
    );

  const groupIds = groups.map((g) => g.id);
  const items = groupIds.length
    ? await db
        .select({
          groupId: s.requirementItem.groupId,
          sort: s.requirementItem.sort,
          certificationTypeId: s.requirementItem.certificationTypeId,
          code: s.certificationType.code,
          name: s.certificationType.name,
        })
        .from(s.requirementItem)
        .innerJoin(
          s.certificationType,
          eq(s.requirementItem.certificationTypeId, s.certificationType.id),
        )
        .where(
          and(
            inArray(s.requirementItem.groupId, groupIds),
            isNull(s.requirementItem.deletedAt),
          ),
        )
    : [];

  const root = groups.find((g) => g.parentGroupId === null);
  if (!root) return null;

  const build = (groupId: string): RequirementNode => {
    const group = groups.find((g) => g.id === groupId)!;
    const childItems = items
      .filter((i) => i.groupId === groupId)
      .map((i) => ({
        sort: i.sort,
        node: {
          kind: "item" as const,
          certificationTypeId: i.certificationTypeId,
          certificationTypeCode: i.code,
          certificationTypeName: i.name,
        },
      }));
    const childGroups = groups
      .filter((g) => g.parentGroupId === groupId)
      .map((g) => ({ sort: g.sort, node: build(g.id) }));

    const children = [...childItems, ...childGroups]
      .sort((a, b) => a.sort - b.sort)
      .map((c) => c.node);

    return { kind: "group", combinator: group.combinator, children };
  };

  return { requirementVersionId: v.id, node: build(root.id) };
}
