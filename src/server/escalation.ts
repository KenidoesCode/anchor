import { and, eq, isNull, lte } from "drizzle-orm";
import type { Db } from "@/db/pg";
import * as s from "@/db/schema";
import { daysBetween } from "@/domain/gate";
import { logActivity } from "./activity";
import { getDirectorFallback, getEscalationStages, type EscalationStage } from "./config";

/**
 * The certification expiry cascade (UXF §4, PRD §5.1). System-initiated, no
 * human trigger. Every threshold, recipient and channel is CONFIG (ADR-0017),
 * read here — nothing about the 90/60/30/7/expiry rule is hardcoded. Assume
 * Greensafe changes all of it; this function does not change when they do.
 *
 * "Each stage fires once" is guaranteed by the escalation_event unique
 * constraint (ADR-0004): an insert that conflicts fires nothing. The job is
 * therefore idempotent and safe to re-run / catch up after a missed run.
 */

type Recipient = { recipientId: string | null; recipientRole: string };

async function resolveRecipient(
  db: Db,
  stage: EscalationStage,
  cert: { id: string; personId: string },
  directorFallback: boolean,
): Promise<Recipient> {
  const fallback: Recipient = { recipientId: null, recipientRole: "director" };

  switch (stage.notifyTarget) {
    case "holder":
      return { recipientId: cert.personId, recipientRole: "holder" };
    case "director":
      return fallback;
    case "line_manager": {
      const [p] = await db
        .select({ mgr: s.person.lineManagerId })
        .from(s.person)
        .where(eq(s.person.id, cert.personId))
        .limit(1);
      if (p?.mgr) return { recipientId: p.mgr, recipientRole: "line_manager" };
      return directorFallback ? fallback : { recipientId: null, recipientRole: "line_manager" };
    }
    case "account_owner": {
      const [row] = await db
        .select({ owner: s.organisation.accountOwnerId })
        .from(s.deployment)
        .innerJoin(s.assignment, eq(s.deployment.assignmentId, s.assignment.id))
        .innerJoin(s.organisation, eq(s.deployment.organisationId, s.organisation.id))
        .where(
          and(
            eq(s.assignment.personId, cert.personId),
            eq(s.deployment.status, "active"),
            isNull(s.deployment.deletedAt),
          ),
        )
        .limit(1);
      if (row?.owner) return { recipientId: row.owner, recipientRole: "account_owner" };
      return directorFallback ? fallback : { recipientId: null, recipientRole: "account_owner" };
    }
  }
}

export interface CascadeResult {
  evaluated: number;
  fired: number;
  renewalTasksCreated: number;
}

export async function runEscalationCascade(
  db: Db,
  now: string,
  actorId: string = s.SYSTEM_ACTOR_ID,
): Promise<CascadeResult> {
  const stages = await getEscalationStages(db);
  const directorFallback = await getDirectorFallback(db);
  const maxWindow = stages.reduce((m, x) => Math.max(m, x.daysBefore), 0);

  // Bound the work: certs already expired, or expiring within the widest window.
  const horizon = addDays(now, maxWindow);
  const certs = await db
    .select({
      id: s.certification.id,
      personId: s.certification.personId,
      code: s.certificationType.code,
      registrationNumber: s.certification.registrationNumber,
      expiryDate: s.certification.expiryDate,
    })
    .from(s.certification)
    .innerJoin(s.certificationType, eq(s.certification.certificationTypeId, s.certificationType.id))
    .where(and(isNull(s.certification.deletedAt), lte(s.certification.expiryDate, horizon)));

  let fired = 0;
  let renewalTasksCreated = 0;

  for (const cert of certs) {
    const daysUntil = daysBetween(now, cert.expiryDate); // negative once expired

    for (const stage of stages) {
      if (daysUntil > stage.daysBefore) continue; // window not yet active

      // Fires-once: the unique(certification_id, stage) constraint decides.
      const inserted = await db
        .insert(s.escalationEvent)
        .values({
          certificationId: cert.id,
          stage: stage.stageKey as (typeof s.escalationStage.enumValues)[number],
          channel: stage.channel,
          createdBy: actorId,
          updatedBy: actorId,
        })
        .onConflictDoNothing({ target: [s.escalationEvent.certificationId, s.escalationEvent.stage] })
        .returning({ id: s.escalationEvent.id });

      if (inserted.length === 0) continue; // already fired
      fired += 1;

      const recipient = await resolveRecipient(db, stage, cert, directorFallback);
      await db
        .update(s.escalationEvent)
        .set({ recipientId: recipient.recipientId, recipientRole: recipient.recipientRole })
        .where(eq(s.escalationEvent.id, inserted[0]!.id));

      const expiredText =
        daysUntil < 0 ? `lapsed ${Math.abs(daysUntil)} days ago` : `expires in ${daysUntil} days`;
      await db.insert(s.notification).values({
        recipientId: recipient.recipientId,
        recipientRole: recipient.recipientRole,
        channel: stage.channel,
        subject: `${cert.code} ${cert.registrationNumber} ${expiredText}`,
        body: `Certification ${cert.code} (${cert.registrationNumber}) ${expiredText}. Stage ${stage.stageKey}.`,
        relatedEntity: "certification",
        relatedId: cert.id,
        createdBy: actorId,
        updatedBy: actorId,
      });

      // The 90-day stage opens a renewal task (evidence closes it — ADR-0008).
      if (stage.daysBefore === maxWindow) {
        const created = await ensureRenewalTask(db, cert, now, actorId);
        if (created) renewalTasksCreated += 1;
      }
    }
  }

  await logActivity(db, {
    actorId,
    action: "escalation.cascade",
    entity: "certification",
    detail: `evaluated=${certs.length} fired=${fired} renewals=${renewalTasksCreated}`,
  });

  return { evaluated: certs.length, fired, renewalTasksCreated };
}

async function ensureRenewalTask(
  db: Db,
  cert: { id: string; personId: string; expiryDate: string },
  now: string,
  actorId: string,
): Promise<boolean> {
  const existing = await db
    .select({ id: s.renewalTask.id })
    .from(s.renewalTask)
    .where(
      and(
        eq(s.renewalTask.certificationId, cert.id),
        eq(s.renewalTask.status, "open"),
        isNull(s.renewalTask.deletedAt),
      ),
    )
    .limit(1);
  if (existing.length > 0) return false;

  await db.insert(s.renewalTask).values({
    certificationId: cert.id,
    personId: cert.personId,
    dueDate: cert.expiryDate,
    source: "cascade_90d",
    createdBy: actorId,
    updatedBy: actorId,
  });
  return true;
}

/** Add whole days to an ISO date, returning ISO. Deterministic, no clock read. */
function addDays(iso: string, days: number): string {
  const ms = Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}
