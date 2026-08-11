import { asc, eq, isNull } from "drizzle-orm";
import * as s from "@/db/schema";
import { publicProcedure, router } from "../trpc";

/** Reference lists for the Assign form. Read-only. */
export const catalogueRouter = router({
  roles: publicProcedure.query(({ ctx }) =>
    ctx.db
      .select({ id: s.role.id, code: s.role.code, name: s.role.name })
      .from(s.role)
      .where(isNull(s.role.deletedAt))
      .orderBy(asc(s.role.code)),
  ),

  sites: publicProcedure.query(({ ctx }) =>
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
