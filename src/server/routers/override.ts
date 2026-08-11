import { z } from "zod";
import { createOverriddenAssignment, resolveOverride } from "../assignment-service";
import { overrideInput } from "@/schemas/override";
import { roleProcedure, router } from "../trpc";

export const overrideRouter = router({
  /** Approve a Director override of a blocked assignment (F1 §3.2). Director only. */
  approve: roleProcedure("director")
    .input(overrideInput)
    .mutation(({ ctx, input }) =>
      createOverriddenAssignment(
        ctx.db,
        input.assignment,
        { requestedBy: input.requestedBy ?? ctx.actorId, justification: input.justification },
        ctx.actorId,
        ctx.today,
      ),
    ),

  /** Close an open override once the underlying issue is resolved. */
  resolve: roleProcedure("director")
    .input(z.object({ overrideId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await resolveOverride(ctx.db, input.overrideId, ctx.actorId);
      return { ok: true };
    }),
});
