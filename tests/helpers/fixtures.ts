import type { Db } from "@/db/pg";
import * as s from "@/db/schema";
import { installDefaultConfig } from "@/server/default-config";

export interface GateFixture {
  roleWshoId: string;
  wshoTypeId: string;
  orgId: string;
  siteId: string;
  validPersonId: string; // WSHO valid to 2028-02-28
  lapsedPersonId: string; // WSHO lapsed 2026-07-31
}

/** Minimal WSHO gate world + default config. Mirrors the Slice-1 integration fixture. */
export async function seedGateWorld(db: Db): Promise<GateFixture> {
  await installDefaultConfig(db, s.SYSTEM_ACTOR_ID);

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

  const [org] = await db.insert(s.organisation).values({ name: "Shimizu" }).returning({ id: s.organisation.id });
  const [site] = await db
    .insert(s.site)
    .values({ organisationId: org!.id, name: "Changi T5" })
    .returning({ id: s.site.id });

  const [valid] = await db.insert(s.person).values({ fullName: "Ng Siew Ling" }).returning({ id: s.person.id });
  await db.insert(s.certification).values({
    personId: valid!.id,
    certificationTypeId: ct!.id,
    registrationNumber: "WSHO/26/01204",
    issueDate: "2023-03-01",
    expiryDate: "2028-02-28",
  });

  const [lapsed] = await db.insert(s.person).values({ fullName: "R. Sundaram" }).returning({ id: s.person.id });
  await db.insert(s.certification).values({
    personId: lapsed!.id,
    certificationTypeId: ct!.id,
    registrationNumber: "WSHO/24/08812",
    issueDate: "2021-08-01",
    expiryDate: "2026-07-31",
  });

  return {
    roleWshoId: role!.id,
    wshoTypeId: ct!.id,
    orgId: org!.id,
    siteId: site!.id,
    validPersonId: valid!.id,
    lapsedPersonId: lapsed!.id,
  };
}
