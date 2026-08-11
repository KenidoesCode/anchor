import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "@/db/pg";
import * as s from "@/db/schema";
import {
  evaluateGate,
  type GateResult,
  type HeldCertification,
  type OverlappingDeployment,
} from "@/domain/gate";
import type { AssignmentInput } from "@/schemas/assignment";
import { getGateConfig } from "./config";
import { resolveRequirement } from "./requirement";

/**
 * Two ISO date intervals overlap; a null end means open-ended (infinite).
 * RATIFIED (KK, 2026-08-14) — pending Greensafe domain confirmation Q-P1-8.
 * Whether overlap is checked at all, and whether bounds are inclusive, are
 * CONFIG (ADR-0017: `gate.overlapEnabled`, `gate.overlapInclusive`) — not
 * constants — so Greensafe can change the rule without a code change.
 */
function intervalsOverlap(
  aStart: string,
  aEnd: string | null,
  bStart: string,
  bEnd: string | null,
  inclusive: boolean,
): boolean {
  const aE = aEnd ?? "9999-12-31";
  const bE = bEnd ?? "9999-12-31";
  return inclusive ? aStart <= bE && bStart <= aE : aStart < bE && bStart < aE;
}

async function heldCertifications(db: Db, personId: string): Promise<HeldCertification[]> {
  const rows = await db
    .select({
      certificationTypeId: s.certification.certificationTypeId,
      certificationTypeCode: s.certificationType.code,
      registrationNumber: s.certification.registrationNumber,
      issueDate: s.certification.issueDate,
      expiryDate: s.certification.expiryDate,
    })
    .from(s.certification)
    .innerJoin(
      s.certificationType,
      eq(s.certification.certificationTypeId, s.certificationType.id),
    )
    .where(and(eq(s.certification.personId, personId), isNull(s.certification.deletedAt)));
  return rows;
}

async function overlappingDeployments(
  db: Db,
  personId: string,
  start: string,
  end: string | null,
  cfg: { overlapEnabled: boolean; overlapInclusive: boolean },
): Promise<OverlappingDeployment[]> {
  if (!cfg.overlapEnabled) return [];
  const rows = await db
    .select({
      siteName: s.site.name,
      roleCode: s.role.code,
      startDate: s.deployment.startDate,
      endDate: s.deployment.endDate,
    })
    .from(s.deployment)
    .innerJoin(s.assignment, eq(s.deployment.assignmentId, s.assignment.id))
    .innerJoin(s.role, eq(s.deployment.roleId, s.role.id))
    .innerJoin(s.site, eq(s.deployment.siteId, s.site.id))
    .where(
      and(
        eq(s.assignment.personId, personId),
        eq(s.deployment.status, "active"),
        isNull(s.deployment.deletedAt),
      ),
    );
  return rows.filter((r) =>
    intervalsOverlap(r.startDate, r.endDate, start, end, cfg.overlapInclusive),
  );
}

const NO_REQUIREMENT: (versionId: string) => GateResult = (versionId) => ({
  outcome: "blocked",
  monitored: false,
  requirementVersionId: versionId,
  reasons: [
    {
      code: "missing",
      message:
        "No certification requirement is configured for this role. Assignment cannot be validated.",
    },
  ],
});

/** The minimum needed to run the gate for one candidate against one role/period. */
export interface GateQuery {
  personId: string;
  roleId: string;
  startDate: string;
  endDate: string | null;
}

/**
 * Run the assignment gate against the live ledger. Read-only; used by the live
 * panel (`assignment.validate`), the pre-sorted officer selector, and the
 * control (`assignment.create`).
 */
export async function runGate(db: Db, q: GateQuery, now: string): Promise<GateResult> {
  const cfg = await getGateConfig(db);

  // ASSUMPTION — UNRATIFIED — pending Q-P1-14 (ADR-0015): which date the
  // requirement version is resolved against. The default is 'today' (server
  // clock); 'deployment_start' is available in config but not the default.
  // The behaviour is now DATA (gate.resolveAsOf) rather than a constant, so
  // Greensafe can switch it without a code change — but the DEFAULT is the
  // unratified assumption and stays 'today' pending their answer.
  const asOf = cfg.resolveAsOf === "deployment_start" ? q.startDate : now;
  const resolved = await resolveRequirement(db, q.roleId, asOf);
  if (!resolved) return NO_REQUIREMENT("");

  const [held, overlaps] = await Promise.all([
    heldCertifications(db, q.personId),
    overlappingDeployments(db, q.personId, q.startDate, q.endDate, cfg),
  ]);

  return evaluateGate({
    now,
    deploymentStart: q.startDate,
    deploymentEnd: q.endDate,
    requirement: resolved.node,
    requirementVersionId: resolved.requirementVersionId,
    heldCertifications: held,
    overlappingDeployments: overlaps,
  });
}

export function validateAssignment(
  db: Db,
  input: AssignmentInput,
  now: string,
): Promise<GateResult> {
  return runGate(db, input, now);
}

export interface CreatedAssignment {
  assignmentId: string;
  deploymentId: string;
  result: GateResult;
}

/**
 * The control. Re-runs the gate server-side and REJECTS a blocked assignment
 * (AC1.1) — a Blocked outcome cannot be persisted through the API. On a
 * non-blocked outcome, writes the Assignment and its 1:1 Deployment (ADR-0007)
 * in one transaction, and an append-only event-log row.
 *
 * Throws `AssignmentBlockedError` on block; the tRPC layer maps it to FORBIDDEN.
 */
export async function createAssignment(
  db: Db,
  input: AssignmentInput,
  actorId: string,
  now: string,
): Promise<CreatedAssignment> {
  const result = await runGate(db, input, now);

  if (result.outcome === "blocked") {
    throw new AssignmentBlockedError(result);
  }
  // Narrow before entering the transaction closure (closures reset narrowing).
  const outcome: "confirmed" | "conditional" = result.outcome;

  return db.transaction(async (tx) => {
    const [a] = await tx
      .insert(s.assignment)
      .values({
        personId: input.personId,
        roleId: input.roleId,
        requirementVersionId: result.requirementVersionId,
        outcome,
        validatedBy: actorId,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning({ id: s.assignment.id });
    const assignmentId = a!.id;

    const [d] = await tx
      .insert(s.deployment)
      .values({
        assignmentId,
        organisationId: input.organisationId,
        siteId: input.siteId,
        roleId: input.roleId,
        startDate: input.startDate,
        endDate: input.endDate,
        chargeRate: input.chargeRate?.toFixed(2) ?? null,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning({ id: s.deployment.id });
    const deploymentId = d!.id;

    await tx.insert(s.eventLog).values({
      actorId,
      action: "assignment.create",
      entity: "deployment",
      entityId: deploymentId,
      detail: `outcome=${result.outcome}${result.monitored ? " (monitored)" : ""}`,
    });

    return { assignmentId, deploymentId, result };
  });
}

/** Raised when the gate blocks; carries the structured result for the caller. */
export class AssignmentBlockedError extends Error {
  constructor(public readonly result: GateResult) {
    super("Assignment blocked");
    this.name = "AssignmentBlockedError";
  }
}

export class OverrideError extends Error {}

/**
 * Director override (F1 §3.2, PRD §5.1). A block may be overridden ONLY by a
 * Director, ONLY with a written justification, and the override is written
 * permanently to the activity log and left OPEN so the deployment surfaces on
 * the Director Overview until resolved (AC1.5). Overrides are expected to be
 * rare; frequency is itself a monitored metric.
 */
export async function createOverriddenAssignment(
  db: Db,
  input: AssignmentInput,
  override: { requestedBy: string; justification: string },
  actorId: string,
  now: string,
): Promise<{ assignmentId: string; deploymentId: string; overrideId: string }> {
  const justification = override.justification.trim();
  if (justification.length < 10) {
    throw new OverrideError("A written justification is required to override a block.");
  }

  const result = await runGate(db, input, now);
  if (result.outcome !== "blocked") {
    throw new OverrideError("This assignment is not blocked; no override is needed.");
  }
  if (!result.requirementVersionId) {
    throw new OverrideError("No requirement is configured for this role; it cannot be overridden.");
  }

  return db.transaction(async (tx) => {
    const [ov] = await tx
      .insert(s.overrideRecord)
      .values({
        requestedBy: override.requestedBy,
        approvedBy: actorId,
        justification,
        status: "open",
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning({ id: s.overrideRecord.id });
    const overrideId = ov!.id;

    const [a] = await tx
      .insert(s.assignment)
      .values({
        personId: input.personId,
        roleId: input.roleId,
        requirementVersionId: result.requirementVersionId,
        outcome: "overridden",
        overrideId,
        validatedBy: actorId,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning({ id: s.assignment.id });
    const assignmentId = a!.id;

    const [d] = await tx
      .insert(s.deployment)
      .values({
        assignmentId,
        organisationId: input.organisationId,
        siteId: input.siteId,
        roleId: input.roleId,
        startDate: input.startDate,
        endDate: input.endDate,
        chargeRate: input.chargeRate?.toFixed(2) ?? null,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning({ id: s.deployment.id });

    // AC1.5: attributable to a named user, with justification, immutable timestamp.
    await tx.insert(s.eventLog).values({
      actorId,
      action: "assignment.override",
      entity: "deployment",
      entityId: d!.id,
      detail: `overrode: ${result.reasons.map((r) => r.message).join(" ")}`,
      reason: justification,
    });

    return { assignmentId, deploymentId: d!.id, overrideId };
  });
}

/** Resolve an open override once the underlying issue is fixed. */
export async function resolveOverride(db: Db, overrideId: string, actorId: string): Promise<void> {
  await db
    .update(s.overrideRecord)
    .set({ status: "resolved", updatedBy: actorId })
    .where(eq(s.overrideRecord.id, overrideId));
  await logActivityInline(db, actorId, overrideId);
}

async function logActivityInline(db: Db, actorId: string, overrideId: string): Promise<void> {
  await db.insert(s.eventLog).values({
    actorId,
    action: "override.resolve",
    entity: "override_record",
    entityId: overrideId,
  });
}
