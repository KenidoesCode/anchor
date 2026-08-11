import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "@/db/pg";
import * as s from "@/db/schema";
import { logActivity } from "./activity";

export class RenewalError extends Error {}

export interface NewCertificateInput {
  registrationNumber: string;
  issueDate: string;
  expiryDate: string;
  documentKey?: string | null;
  documentFilename?: string | null;
}

/**
 * Close a renewal task by uploading a NEW certificate with a later expiry
 * (ADR-0008, F2.1 — evidence closes the loop, not assertion). The DB CHECK
 * guarantees a closed task carries its closing certificate; the same-type and
 * later-expiry rules are enforced here (the half deliberately left in the
 * procedure). The superseded certificate is retained, soft-deleted, with the
 * supersession link intact — its history row survives (ADR-0013).
 */
export async function closeRenewalTask(
  db: Db,
  taskId: string,
  newCert: NewCertificateInput,
  actorId: string,
  now: string,
): Promise<{ renewalTaskId: string; newCertificationId: string }> {
  return db.transaction(async (tx) => {
    const [task] = await tx
      .select()
      .from(s.renewalTask)
      .where(and(eq(s.renewalTask.id, taskId), isNull(s.renewalTask.deletedAt)))
      .limit(1);
    if (!task) throw new RenewalError("Renewal task not found.");
    if (task.status === "closed") throw new RenewalError("Renewal task is already closed.");

    const [oldCert] = await tx
      .select()
      .from(s.certification)
      .where(eq(s.certification.id, task.certificationId))
      .limit(1);
    if (!oldCert) throw new RenewalError("Expiring certification not found.");

    if (newCert.expiryDate <= oldCert.expiryDate) {
      throw new RenewalError(
        `The new certificate must expire after the current one (${oldCert.expiryDate}).`,
      );
    }

    const [created] = await tx
      .insert(s.certification)
      .values({
        personId: oldCert.personId,
        certificationTypeId: oldCert.certificationTypeId, // same type
        registrationNumber: newCert.registrationNumber,
        issueDate: newCert.issueDate,
        expiryDate: newCert.expiryDate,
        documentKey: newCert.documentKey ?? null,
        documentFilename: newCert.documentFilename ?? null,
        supersedesCertificationId: oldCert.id,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning({ id: s.certification.id });
    const newCertificationId = created!.id;

    // Retain the superseded certificate, soft-deleted (removed from the live pool).
    await tx
      .update(s.certification)
      .set({ deletedAt: new Date(`${now}T00:00:00Z`), updatedBy: actorId })
      .where(eq(s.certification.id, oldCert.id));

    await tx
      .update(s.renewalTask)
      .set({ status: "closed", closedByCertificationId: newCertificationId, updatedBy: actorId })
      .where(eq(s.renewalTask.id, taskId));

    await tx.insert(s.eventLog).values({
      actorId,
      action: "renewal.close",
      entity: "renewal_task",
      entityId: taskId,
      detail: `superseded ${oldCert.id} → ${newCertificationId}`,
    });

    return { renewalTaskId: taskId, newCertificationId };
  });
}

export async function openRenewalTasks(db: Db) {
  return db
    .select({
      id: s.renewalTask.id,
      dueDate: s.renewalTask.dueDate,
      source: s.renewalTask.source,
      personName: s.person.fullName,
      certificationCode: s.certificationType.code,
      registrationNumber: s.certification.registrationNumber,
      expiryDate: s.certification.expiryDate,
    })
    .from(s.renewalTask)
    .innerJoin(s.person, eq(s.renewalTask.personId, s.person.id))
    .innerJoin(s.certification, eq(s.renewalTask.certificationId, s.certification.id))
    .innerJoin(s.certificationType, eq(s.certification.certificationTypeId, s.certificationType.id))
    .where(and(eq(s.renewalTask.status, "open"), isNull(s.renewalTask.deletedAt)));
}
