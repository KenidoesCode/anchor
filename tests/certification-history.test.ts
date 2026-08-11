import { eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/pg";
import * as s from "@/db/schema";
import { deployedUnderLapsedCert } from "@/server/reporting";
import { makeTestDb } from "./helpers/test-db";

let db: Db;
let close: () => Promise<void>;

beforeEach(async () => {
  ({ db, close } = await makeTestDb());
});
afterEach(async () => {
  await close();
});

async function clockTs(): Promise<string> {
  const res = await db.execute(sql`select clock_timestamp() as t`);
  const rows =
    (res as unknown as { rows?: Array<{ t: unknown }> }).rows ??
    (res as unknown as Array<{ t: unknown }>);
  const t = rows[0]!.t;
  return t instanceof Date ? t.toISOString() : String(t);
}

/**
 * An officer deployed 2026-01-01 → 2026-12-31 whose sole WSHO certificate
 * expires 2026-07-31 — i.e. lapsed mid-deployment. As of 2026-08-11 they are
 * deployed under a lapsed certification.
 */
async function seedDeployedUnderLapsed() {
  const [auth] = await db.insert(s.authority).values({ code: "MOM", name: "MOM" }).returning({ id: s.authority.id });
  const [ct] = await db
    .insert(s.certificationType)
    .values({ code: "WSHO", name: "WSHO", authorityId: auth!.id })
    .returning({ id: s.certificationType.id });
  const [role] = await db.insert(s.role).values({ code: "WSHO", name: "WSHO" }).returning({ id: s.role.id });
  const [rv] = await db
    .insert(s.roleRequirementVersion)
    .values({ roleId: role!.id, versionNo: 1, validFrom: "2000-01-01" })
    .returning({ id: s.roleRequirementVersion.id });
  const [g] = await db
    .insert(s.requirementGroup)
    .values({ requirementVersionId: rv!.id, combinator: "all_of" })
    .returning({ id: s.requirementGroup.id });
  await db.insert(s.requirementItem).values({ groupId: g!.id, certificationTypeId: ct!.id });

  const [p] = await db.insert(s.person).values({ fullName: "R. Sundaram" }).returning({ id: s.person.id });
  const [cert] = await db
    .insert(s.certification)
    .values({
      personId: p!.id,
      certificationTypeId: ct!.id,
      registrationNumber: "WSHO/24/08812",
      issueDate: "2021-08-01",
      expiryDate: "2026-07-31",
    })
    .returning({ id: s.certification.id });

  const [org] = await db.insert(s.organisation).values({ name: "Shimizu" }).returning({ id: s.organisation.id });
  const [site] = await db
    .insert(s.site)
    .values({ organisationId: org!.id, name: "Changi T5" })
    .returning({ id: s.site.id });
  const [asg] = await db
    .insert(s.assignment)
    .values({
      personId: p!.id,
      roleId: role!.id,
      requirementVersionId: rv!.id,
      outcome: "confirmed",
      validatedBy: s.SYSTEM_ACTOR_ID,
    })
    .returning({ id: s.assignment.id });
  await db.insert(s.deployment).values({
    assignmentId: asg!.id,
    organisationId: org!.id,
    siteId: site!.id,
    roleId: role!.id,
    startDate: "2026-01-01",
    endDate: "2026-12-31",
  });

  return { certId: cert!.id };
}

describe("certification history (ADR-0013)", () => {
  it("writes a history row on insert and a new one on update, closing the prior", async () => {
    const { certId } = await seedDeployedUnderLapsed();
    let rows = await db
      .select()
      .from(s.certificationHistory)
      .where(eq(s.certificationHistory.certificationId, certId));
    expect(rows.length).toBe(1);
    expect(rows[0]?.operation).toBe("insert");
    expect(rows[0]?.sysTo).toBeNull();

    await db
      .update(s.certification)
      .set({ expiryDate: "2027-07-31" })
      .where(eq(s.certification.id, certId));

    rows = await db
      .select()
      .from(s.certificationHistory)
      .where(eq(s.certificationHistory.certificationId, certId));
    expect(rows.length).toBe(2);
    const open = rows.filter((r) => r.sysTo === null);
    const closed = rows.filter((r) => r.sysTo !== null);
    expect(open.length).toBe(1);
    expect(closed.length).toBe(1);
    expect(open[0]?.expiryDate).toBe("2027-07-31");
    expect(closed[0]?.expiryDate).toBe("2026-07-31");
  });

  // The defining test: an in-place expiry correction must NOT change the
  // historical answer to "who was deployed under a lapsed cert on 2026-08-11?"
  it("an in-place expiry correction does not rewrite the past-date exposure figure", async () => {
    const { certId } = await seedDeployedUnderLapsed();
    const D = "2026-08-11";

    // Current belief before any correction: the officer is exposed.
    expect(await deployedUnderLapsedCert(db, D)).toBe(1);

    // Freeze the transaction time we will reconstruct "as known at".
    const T0 = await clockTs();

    // Someone corrects the expiry date in place (fat-finger fix): now valid to 2027.
    await db
      .update(s.certification)
      .set({ expiryDate: "2027-07-31" })
      .where(eq(s.certification.id, certId));

    // As known at T0, the answer is unchanged — the correction did not rewrite history.
    expect(await deployedUnderLapsedCert(db, D, T0)).toBe(1);

    // Under current belief, the correction is reflected — no longer exposed on D.
    expect(await deployedUnderLapsedCert(db, D)).toBe(0);
  });
});
