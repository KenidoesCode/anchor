import { eq } from "drizzle-orm";
import type { Db } from "@/db/pg";
import * as s from "@/db/schema";
import { logActivity } from "./activity";
import { decryptNric, encryptNric, maskNric } from "./crypto";

export class PersonError extends Error {}

export interface CreatePersonInput {
  fullName: string;
  employmentStatus?: "employed" | "associate" | "inactive";
  homeBase?: string | null;
  languages?: string[];
  nationalId?: string | null;
}

export async function createPerson(db: Db, input: CreatePersonInput, actorId: string): Promise<string> {
  const enc = input.nationalId ? encryptNric(input.nationalId) : null;
  const [p] = await db
    .insert(s.person)
    .values({
      fullName: input.fullName,
      employmentStatus: input.employmentStatus ?? "employed",
      homeBase: input.homeBase ?? null,
      languages: input.languages ?? [],
      nationalIdCiphertext: enc?.ciphertext ?? null,
      nationalIdLast4: enc?.last4 ?? null,
      createdBy: actorId,
      updatedBy: actorId,
    })
    .returning({ id: s.person.id });
  // Never log the identifier itself.
  await logActivity(db, { actorId, action: "person.create", entity: "person", entityId: p!.id });
  return p!.id;
}

export interface AddCertificationInput {
  personId: string;
  certificationTypeId: string;
  registrationNumber: string;
  issueDate: string;
  expiryDate: string;
  documentKey?: string | null;
  documentFilename?: string | null;
}

export async function addCertification(db: Db, input: AddCertificationInput, actorId: string): Promise<string> {
  const [ct] = await db
    .select({ pattern: s.certificationType.validationPattern, code: s.certificationType.code })
    .from(s.certificationType)
    .where(eq(s.certificationType.id, input.certificationTypeId))
    .limit(1);
  if (!ct) throw new PersonError("Unknown certification type.");
  // Validate at entry when a format is configured (Q-P1-5: patterns are config).
  if (ct.pattern && !new RegExp(ct.pattern).test(input.registrationNumber)) {
    throw new PersonError(`Registration number does not match the ${ct.code} format.`);
  }
  if (input.expiryDate <= input.issueDate) {
    throw new PersonError("Expiry date must be after the issue date.");
  }

  const [c] = await db
    .insert(s.certification)
    .values({
      personId: input.personId,
      certificationTypeId: input.certificationTypeId,
      registrationNumber: input.registrationNumber,
      issueDate: input.issueDate,
      expiryDate: input.expiryDate,
      documentKey: input.documentKey ?? null,
      documentFilename: input.documentFilename ?? null,
      createdBy: actorId,
      updatedBy: actorId,
    })
    .returning({ id: s.certification.id });
  await logActivity(db, { actorId, action: "certification.add", entity: "certification", entityId: c!.id });
  return c!.id;
}

/** A person record with the national identifier MASKED — the default response. */
export async function getPersonMasked(db: Db, personId: string) {
  const [p] = await db.select().from(s.person).where(eq(s.person.id, personId)).limit(1);
  if (!p) return null;
  return {
    id: p.id,
    fullName: p.fullName,
    employmentStatus: p.employmentStatus,
    homeBase: p.homeBase,
    languages: p.languages,
    nationalIdMasked: maskNric(p.nationalIdLast4),
  };
}

/**
 * Unmask a national identifier — a distinct, REASON-REQUIRED, LOGGED procedure
 * (PRD §10.2). Held only by Training Administrator and Director (enforced at the
 * router). The reason is written to the immutable log; the value is never logged.
 */
export async function unmaskNationalId(
  db: Db,
  personId: string,
  reason: string,
  actorId: string,
): Promise<string> {
  if (reason.trim().length < 5) throw new PersonError("A reason is required to unmask a national identifier.");
  const [p] = await db
    .select({ ct: s.person.nationalIdCiphertext })
    .from(s.person)
    .where(eq(s.person.id, personId))
    .limit(1);
  if (!p?.ct) throw new PersonError("No national identifier on file.");
  await logActivity(db, {
    actorId,
    action: "person.unmask_nric",
    entity: "person",
    entityId: personId,
    reason,
  });
  return decryptNric(p.ct);
}
