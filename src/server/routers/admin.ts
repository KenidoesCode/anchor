import { eq } from "drizzle-orm";
import { z } from "zod";
import * as s from "@/db/schema";
import { isoDate } from "@/schemas/assignment";
import { logActivity } from "../activity";
import { createRequirementVersion } from "../admin-service";
import { roleProcedure, router } from "../trpc";

/** Admin surface — configuration is data (ADR-0017). Director only. */
const admin = roleProcedure("director");

export const adminRouter = router({
  listSettings: admin.query(({ ctx }) =>
    ctx.db.select().from(s.appSetting).orderBy(s.appSetting.key),
  ),
  listEscalationStages: admin.query(({ ctx }) =>
    ctx.db.select().from(s.escalationStageConfig).orderBy(s.escalationStageConfig.sortOrder),
  ),

  createAuthority: admin
    .input(z.object({ code: z.string().min(1), name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [r] = await ctx.db
        .insert(s.authority)
        .values({ ...input, createdBy: ctx.actorId, updatedBy: ctx.actorId })
        .returning({ id: s.authority.id });
      return r;
    }),

  createCertificationType: admin
    .input(
      z.object({
        code: z.string().min(1),
        name: z.string().min(1),
        authorityId: z.string().uuid(),
        validationPattern: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [r] = await ctx.db
        .insert(s.certificationType)
        .values({
          code: input.code,
          name: input.name,
          authorityId: input.authorityId,
          validationPattern: input.validationPattern ?? null,
          createdBy: ctx.actorId,
          updatedBy: ctx.actorId,
        })
        .returning({ id: s.certificationType.id });
      return r;
    }),

  createRole: admin
    .input(z.object({ code: z.string().min(1), name: z.string().min(1), description: z.string().nullable().optional() }))
    .mutation(async ({ ctx, input }) => {
      const [r] = await ctx.db
        .insert(s.role)
        .values({ code: input.code, name: input.name, description: input.description ?? null, createdBy: ctx.actorId, updatedBy: ctx.actorId })
        .returning({ id: s.role.id });
      return r;
    }),

  /** New effective-dated requirement version (ADR-0002/0003). */
  createRequirementVersion: admin
    .input(
      z.object({
        roleId: z.string().uuid(),
        validFrom: isoDate,
        combinator: z.enum(["all_of", "any_of"]),
        itemCertificationTypeIds: z.array(z.string().uuid()).min(1),
      }),
    )
    .mutation(({ ctx, input }) => createRequirementVersion(ctx.db, input, ctx.actorId)),

  /** Change a scalar rule (e.g. overlap on/off, resolve-as-of) — data, not code. */
  updateSetting: admin
    .input(z.object({ key: z.string(), value: z.unknown() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.update(s.appSetting).set({ value: input.value, updatedBy: ctx.actorId }).where(eq(s.appSetting.key, input.key));
      await logActivity(ctx.db, { actorId: ctx.actorId, action: "config.setting.update", entity: "app_setting", detail: input.key });
      return { ok: true };
    }),

  /** Change an escalation stage (threshold/recipient/channel) — data, not code. */
  updateEscalationStage: admin
    .input(
      z.object({
        stageKey: z.string(),
        daysBefore: z.number().int().optional(),
        notifyTarget: z.enum(["holder", "line_manager", "account_owner", "director"]).optional(),
        channel: z.enum(["in_app", "email", "sms"]).optional(),
        active: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { stageKey, ...patch } = input;
      await ctx.db
        .update(s.escalationStageConfig)
        .set({ ...patch, updatedBy: ctx.actorId })
        .where(eq(s.escalationStageConfig.stageKey, stageKey));
      await logActivity(ctx.db, { actorId: ctx.actorId, action: "config.stage.update", entity: "escalation_stage_config", detail: stageKey });
      return { ok: true };
    }),
});
