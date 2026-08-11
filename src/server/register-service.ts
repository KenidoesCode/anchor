import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "@/db/pg";
import * as s from "@/db/schema";
import { daysBetween } from "@/domain/gate";

/** A certification's derived status. Ordering: worst first (UXS §3, §5.2, ADR: worst-status sort). */
export type CertStatus = "lapsed" | "expiring" | "valid";
const SEVERITY: Record<CertStatus, number> = { lapsed: 0, expiring: 1, valid: 2 };

export function certStatus(expiryDate: string, today: string, expiringWithinDays = 90): CertStatus {
  const days = daysBetween(today, expiryDate);
  if (days < 0) return "lapsed";
  if (days <= expiringWithinDays) return "expiring";
  return "valid";
}

/** People Register (UXS §5.2): worst-status first, then soonest expiry. Not alphabetical. */
export async function registerPeople(db: Db, today: string) {
  const people = await db
    .select({ id: s.person.id, fullName: s.person.fullName })
    .from(s.person)
    .where(isNull(s.person.deletedAt));

  const certs = await db
    .select({
      personId: s.certification.personId,
      code: s.certificationType.code,
      expiryDate: s.certification.expiryDate,
    })
    .from(s.certification)
    .innerJoin(s.certificationType, eq(s.certification.certificationTypeId, s.certificationType.id))
    .where(isNull(s.certification.deletedAt));

  const deployments = await db
    .select({ personId: s.assignment.personId, siteName: s.site.name })
    .from(s.deployment)
    .innerJoin(s.assignment, eq(s.deployment.assignmentId, s.assignment.id))
    .innerJoin(s.site, eq(s.deployment.siteId, s.site.id))
    .where(and(eq(s.deployment.status, "active"), isNull(s.deployment.deletedAt)));

  const rows = people.map((p) => {
    const own = certs.filter((c) => c.personId === p.id);
    const statuses = own.map((c) => certStatus(c.expiryDate, today));
    const worst = statuses.reduce<CertStatus | null>(
      (w, st) => (w === null || SEVERITY[st] < SEVERITY[w] ? st : w),
      null,
    );
    const nextExpiry = own.length
      ? own.map((c) => c.expiryDate).sort()[0]!
      : null;
    return {
      personId: p.id,
      fullName: p.fullName,
      certificationsHeld: [...new Set(own.map((c) => c.code))],
      worstStatus: worst,
      nextExpiry,
      deployedAt: [...new Set(deployments.filter((d) => d.personId === p.id).map((d) => d.siteName))],
    };
  });

  // Worst status first (nulls last), then soonest expiry.
  return rows.sort((a, b) => {
    const sa = a.worstStatus ? SEVERITY[a.worstStatus] : 99;
    const sb = b.worstStatus ? SEVERITY[b.worstStatus] : 99;
    if (sa !== sb) return sa - sb;
    return (a.nextExpiry ?? "9999").localeCompare(b.nextExpiry ?? "9999");
  });
}

/** Certifications expiry board (UXS §5.4): each active cert with its bucket + deployment. */
export async function certificationsBoard(db: Db, today: string) {
  const rows = await db
    .select({
      certId: s.certification.id,
      personId: s.certification.personId,
      personName: s.person.fullName,
      code: s.certificationType.code,
      registrationNumber: s.certification.registrationNumber,
      expiryDate: s.certification.expiryDate,
    })
    .from(s.certification)
    .innerJoin(s.person, eq(s.certification.personId, s.person.id))
    .innerJoin(s.certificationType, eq(s.certification.certificationTypeId, s.certificationType.id))
    .where(isNull(s.certification.deletedAt));

  const deployed = await db
    .select({ personId: s.assignment.personId, siteName: s.site.name })
    .from(s.deployment)
    .innerJoin(s.assignment, eq(s.deployment.assignmentId, s.assignment.id))
    .innerJoin(s.site, eq(s.deployment.siteId, s.site.id))
    .where(and(eq(s.deployment.status, "active"), isNull(s.deployment.deletedAt)));

  return rows.map((r) => {
    const days = daysBetween(today, r.expiryDate);
    return {
      ...r,
      daysRemaining: days,
      status: certStatus(r.expiryDate, today),
      deployedAt: deployed.find((d) => d.personId === r.personId)?.siteName ?? null,
    };
  });
}

/** Deployments coverage view (PRD §5.1): who is posted where, with live validity. */
export async function deploymentsView(db: Db, today: string) {
  const rows = await db
    .select({
      deploymentId: s.deployment.id,
      personId: s.assignment.personId,
      personName: s.person.fullName,
      orgName: s.organisation.name,
      siteName: s.site.name,
      roleCode: s.role.code,
      startDate: s.deployment.startDate,
      endDate: s.deployment.endDate,
      outcome: s.assignment.outcome,
    })
    .from(s.deployment)
    .innerJoin(s.assignment, eq(s.deployment.assignmentId, s.assignment.id))
    .innerJoin(s.person, eq(s.assignment.personId, s.person.id))
    .innerJoin(s.organisation, eq(s.deployment.organisationId, s.organisation.id))
    .innerJoin(s.site, eq(s.deployment.siteId, s.site.id))
    .innerJoin(s.role, eq(s.deployment.roleId, s.role.id))
    .where(and(eq(s.deployment.status, "active"), isNull(s.deployment.deletedAt)));

  const certs = await db
    .select({ personId: s.certification.personId, expiryDate: s.certification.expiryDate })
    .from(s.certification)
    .where(isNull(s.certification.deletedAt));

  return rows.map((r) => {
    const own = certs.filter((c) => c.personId === r.personId);
    const worst = own
      .map((c) => certStatus(c.expiryDate, today))
      .reduce<CertStatus | null>((w, st) => (w === null || SEVERITY[st] < SEVERITY[w] ? st : w), null);
    return { ...r, validity: worst ?? "valid" };
  });
}
