/**
 * FICTIONAL demonstration data — Greensafe Assure Slice 1.
 *
 * Every person, registration number and client below is invented for demos and
 * tests. This file lives under seed/ and must never be reachable from a
 * production code path (CLAUDE.md). Run against a local dev database only:
 *   pnpm db:migrate && pnpm db:seed
 *
 * The cast mirrors UXS §5.3 so the Assign screen shows one of each outcome
 * against a 1 Sep – 31 Dec 2026 deployment: Confirmed, Conditional, Blocked.
 */
import { getDb } from "@/db/pg";
import * as s from "@/db/schema";

async function main() {
  const db = getDb();

  const [mom] = await db
    .insert(s.authority)
    .values({ code: "MOM", name: "Ministry of Manpower" })
    .returning({ id: s.authority.id });
  const [scdf] = await db
    .insert(s.authority)
    .values({ code: "SCDF", name: "Singapore Civil Defence Force" })
    .returning({ id: s.authority.id });

  // NOTE: validation_pattern intentionally null — real MOM/SCDF registration
  // formats are unverified (Q-P1-5). No guessed format is hardcoded.
  const [wshoType] = await db
    .insert(s.certificationType)
    .values({ code: "WSHO", name: "Workplace Safety & Health Officer", authorityId: mom!.id })
    .returning({ id: s.certificationType.id });
  const [fsmType] = await db
    .insert(s.certificationType)
    .values({ code: "FSM", name: "Fire Safety Manager", authorityId: scdf!.id })
    .returning({ id: s.certificationType.id });

  // Roles and their (effective-dated, single-item all_of) requirements.
  async function roleRequiring(code: string, name: string, typeId: string): Promise<string> {
    const [role] = await db
      .insert(s.role)
      .values({ code, name })
      .returning({ id: s.role.id });
    const [rv] = await db
      .insert(s.roleRequirementVersion)
      .values({ roleId: role!.id, versionNo: 1, validFrom: "2000-01-01", validTo: null })
      .returning({ id: s.roleRequirementVersion.id });
    const [group] = await db
      .insert(s.requirementGroup)
      .values({ requirementVersionId: rv!.id, combinator: "all_of", parentGroupId: null })
      .returning({ id: s.requirementGroup.id });
    await db
      .insert(s.requirementItem)
      .values({ groupId: group!.id, certificationTypeId: typeId });
    return role!.id;
  }

  await roleRequiring("WSHO", "Workplace Safety & Health Officer", wshoType!.id);
  await roleRequiring("FSM", "Fire Safety Manager", fsmType!.id);

  // Clients and sites.
  const [shimizu] = await db
    .insert(s.organisation)
    .values({ name: "Shimizu Corporation", sector: "Construction" })
    .returning({ id: s.organisation.id });
  const [obayashi] = await db
    .insert(s.organisation)
    .values({ name: "Obayashi Corporation", sector: "Construction" })
    .returning({ id: s.organisation.id });
  await db.insert(s.site).values({ organisationId: shimizu!.id, name: "Changi T5" });
  await db.insert(s.site).values({ organisationId: obayashi!.id, name: "Marina South" });

  // People + their certifications (states as of 2026-08-11).
  async function officer(
    fullName: string,
    certs: { typeId: string; reg: string; issue: string; expiry: string }[],
  ) {
    const [p] = await db
      .insert(s.person)
      .values({ fullName })
      .returning({ id: s.person.id });
    for (const c of certs) {
      await db.insert(s.certification).values({
        personId: p!.id,
        certificationTypeId: c.typeId,
        registrationNumber: c.reg,
        issueDate: c.issue,
        expiryDate: c.expiry,
      });
    }
  }

  await officer("Ng Siew Ling", [
    { typeId: wshoType!.id, reg: "WSHO/26/01204", issue: "2023-03-01", expiry: "2028-02-28" },
  ]); // Confirmed
  await officer("K. Rajendran", [
    { typeId: wshoType!.id, reg: "WSHO/25/00417", issue: "2022-11-14", expiry: "2027-11-14" },
  ]); // Confirmed
  await officer("Mohamed Faizal", [
    { typeId: wshoType!.id, reg: "WSHO/24/07330", issue: "2021-09-28", expiry: "2026-09-28" },
  ]); // Conditional — expires within the deployment period
  await officer("Tan Boon Hock", [
    { typeId: fsmType!.id, reg: "FSM/24/00991", issue: "2022-01-10", expiry: "2027-01-10" },
  ]); // Blocked — no WSHO
  await officer("R. Sundaram", [
    { typeId: wshoType!.id, reg: "WSHO/24/08812", issue: "2021-08-01", expiry: "2026-07-31" },
  ]); // Blocked — WSHO lapsed

  // eslint-disable-next-line no-console
  console.log("Seeded FICTIONAL demo data. Assign a WSHO for 1 Sep – 31 Dec 2026 to see all outcomes.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
