/**
 * FICTIONAL demonstration data — Greensafe Assure.
 *
 * Every person, registration number and certification below is invented. Client
 * organisation names may echo Greensafe's published client list; nothing else is
 * real. This file lives under seed/ and must never run against a production
 * database (CLAUDE.md). Local dev only: pnpm db:migrate && pnpm db:seed
 *
 * The scenario is built to tell the story in sixty seconds (DEMO.md):
 *   - R. Sundaram — deployed under a LAPSED WSHO (via Director override) → shows on the Overview
 *   - Mohamed Faizal — WSHO expiring within 30 days → CONDITIONAL deployment + renewal task
 *   - Ng Siew Ling, K. Rajendran — valid, one deployed
 *   - Tan Boon Hock — holds only FSM, lacks the required WSHO entirely
 *   - Populated cascade output (notifications, renewal tasks) and activity log
 */
import { eq } from "drizzle-orm";
import { getDb } from "@/db/pg";
import * as s from "@/db/schema";
import { createAssignment, createOverriddenAssignment } from "@/server/assignment-service";
import { hashPassword } from "@/server/auth";
import { installDefaultConfig } from "@/server/default-config";
import { runEscalationCascade } from "@/server/escalation";
import { dispatchPending } from "@/server/notifications";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (base: string, n: number) => iso(new Date(Date.parse(`${base}T00:00:00Z`) + n * 86_400_000));

async function main() {
  const db = getDb();
  const A = s.SYSTEM_ACTOR_ID;
  const today = iso(new Date());

  await installDefaultConfig(db, A);

  const [mom] = await db.insert(s.authority).values({ code: "MOM", name: "Ministry of Manpower" }).returning({ id: s.authority.id });
  const [scdf] = await db.insert(s.authority).values({ code: "SCDF", name: "Singapore Civil Defence Force" }).returning({ id: s.authority.id });

  const [wsho] = await db.insert(s.certificationType).values({ code: "WSHO", name: "Workplace Safety & Health Officer", authorityId: mom!.id }).returning({ id: s.certificationType.id });
  const [fsm] = await db.insert(s.certificationType).values({ code: "FSM", name: "Fire Safety Manager", authorityId: scdf!.id }).returning({ id: s.certificationType.id });

  async function roleRequiring(code: string, name: string, typeId: string): Promise<string> {
    const [role] = await db.insert(s.role).values({ code, name }).returning({ id: s.role.id });
    const [rv] = await db.insert(s.roleRequirementVersion).values({ roleId: role!.id, versionNo: 1, validFrom: "2000-01-01" }).returning({ id: s.roleRequirementVersion.id });
    const [g] = await db.insert(s.requirementGroup).values({ requirementVersionId: rv!.id, combinator: "all_of" }).returning({ id: s.requirementGroup.id });
    await db.insert(s.requirementItem).values({ groupId: g!.id, certificationTypeId: typeId });
    return role!.id;
  }
  const wshoRoleId = await roleRequiring("WSHO", "Workplace Safety & Health Officer", wsho!.id);
  await roleRequiring("FSM", "Fire Safety Manager", fsm!.id);

  const [shimizu] = await db.insert(s.organisation).values({ name: "Shimizu Corporation", sector: "Construction" }).returning({ id: s.organisation.id });
  const [obayashi] = await db.insert(s.organisation).values({ name: "Obayashi Corporation", sector: "Construction" }).returning({ id: s.organisation.id });
  const [changi] = await db.insert(s.site).values({ organisationId: shimizu!.id, name: "Changi T5" }).returning({ id: s.site.id });
  const [marina] = await db.insert(s.site).values({ organisationId: obayashi!.id, name: "Marina South" }).returning({ id: s.site.id });

  async function officer(fullName: string, cert: { typeId: string; reg: string; issue: string; expiry: string }): Promise<string> {
    const [p] = await db.insert(s.person).values({ fullName }).returning({ id: s.person.id });
    await db.insert(s.certification).values({ personId: p!.id, certificationTypeId: cert.typeId, registrationNumber: cert.reg, issueDate: cert.issue, expiryDate: cert.expiry });
    return p!.id;
  }

  const ng = await officer("Ng Siew Ling", { typeId: wsho!.id, reg: "WSHO/26/01204", issue: "2023-03-01", expiry: addDays(today, 900) });
  await officer("K. Rajendran", { typeId: wsho!.id, reg: "WSHO/25/00417", issue: "2022-11-14", expiry: addDays(today, 460) });
  const faizal = await officer("Mohamed Faizal", { typeId: wsho!.id, reg: "WSHO/24/07330", issue: "2021-09-28", expiry: addDays(today, 25) });
  await officer("Tan Boon Hock", { typeId: fsm!.id, reg: "FSM/24/00991", issue: "2022-01-10", expiry: addDays(today, 300) });
  const sundaram = await officer("R. Sundaram", { typeId: wsho!.id, reg: "WSHO/24/08812", issue: "2021-08-01", expiry: addDays(today, -11) });

  const period = { startDate: addDays(today, -10), endDate: addDays(today, 140) };

  // Confirmed: valid officer deployed.
  await createAssignment(db, { personId: ng, roleId: wshoRoleId, organisationId: shimizu!.id, siteId: changi!.id, ...period }, A, today);

  // Conditional: expiring officer deployed (cert lapses before the posting ends).
  await createAssignment(db, { personId: faizal, roleId: wshoRoleId, organisationId: obayashi!.id, siteId: marina!.id, ...period }, A, today);

  // Overridden: lapsed officer deployed under a Director override → shows on the Overview.
  await createOverriddenAssignment(
    db,
    { personId: sundaram, roleId: wshoRoleId, organisationId: shimizu!.id, siteId: changi!.id, ...period },
    { requestedBy: A, justification: "Emergency cover authorised by Director; renewal already in progress." },
    A,
    today,
  );

  // Run the cascade so certifications, renewals and notifications look inhabited.
  await runEscalationCascade(db, today, A);
  await dispatchPending(db);

  // FICTIONAL users. Password for every demo account is "greensafe".
  const pw = hashPassword("greensafe");
  const [sPerson] = await db.select({ id: s.person.id }).from(s.person).where(eq(s.person.id, sundaram)).limit(1);
  await db.insert(s.appUser).values([
    { email: "karu@greensafe.test", fullName: "Karu (Director)", role: "director", passwordHash: pw },
    { email: "coord@greensafe.test", fullName: "Deployment Coordinator", role: "deployment_coordinator", passwordHash: pw },
    { email: "trainingadmin@greensafe.test", fullName: "Training Administrator", role: "training_admin", passwordHash: pw },
    { email: "officer@greensafe.test", fullName: "R. Sundaram", role: "deployed_officer", passwordHash: pw, personId: sPerson?.id ?? null },
  ]);

  // eslint-disable-next-line no-console
  console.log("Seeded FICTIONAL demo scenario, config and users (password 'greensafe'). See DEMO.md.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
