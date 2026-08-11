import { asc, eq, isNull } from "drizzle-orm";
import * as s from "@/db/schema";
import { protectedProcedure, router } from "../trpc";

/** Reference lists for the Assign form. Read-only. */
export const catalogueRouter = router({
  roles: protectedProcedure.query(({ ctx }) =>
    ctx.db
      .select({ id: s.role.id, code: s.role.code, name: s.role.name })
      .from(s.role)
      .where(isNull(s.role.deletedAt))
      .orderBy(asc(s.role.code)),
  ),

  certificationTypes: protectedProcedure.query(({ ctx }) =>
    ctx.db
      .select({ id: s.certificationType.id, code: s.certificationType.code, name: s.certificationType.name })
      .from(s.certificationType)
      .where(isNull(s.certificationType.deletedAt))
      .orderBy(asc(s.certificationType.code)),
  ),

  authorities: protectedProcedure.query(({ ctx }) =>
    ctx.db
      .select({ id: s.authority.id, code: s.authority.code, name: s.authority.name })
      .from(s.authority)
      .where(isNull(s.authority.deletedAt))
      .orderBy(asc(s.authority.code)),
  ),

  sites: protectedProcedure.query(({ ctx }) =>
    ctx.db
      .select({
        id: s.site.id,
        name: s.site.name,
        organisationId: s.organisation.id,
        organisationName: s.organisation.name,
      })
      .from(s.site)
      .innerJoin(s.organisation, eq(s.site.organisationId, s.organisation.id))
      .where(isNull(s.site.deletedAt))
      .orderBy(asc(s.organisation.name)),
  ),
});
