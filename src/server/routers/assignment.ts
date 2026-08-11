import { TRPCError } from "@trpc/server";
import { assignmentInput } from "@/schemas/assignment";
import {
  AssignmentBlockedError,
  createAssignment,
  validateAssignment,
} from "../assignment-service";
import { publicProcedure, router } from "../trpc";

export const assignmentRouter = router({
  /** Live gate for the validation panel (UXS §5.3). Read-only. */
  validate: publicProcedure.input(assignmentInput).query(({ ctx, input }) =>
    validateAssignment(ctx.db, input, ctx.today),
  ),

  /**
   * Persist an assignment + its deployment. The server re-runs the gate and
   * rejects a Blocked outcome (AC1.1) — the disabled Save button is only
   * presentation. Slice 2 adds the role check that only a Coordinator/Director
   * may call this.
   */
  create: publicProcedure.input(assignmentInput).mutation(async ({ ctx, input }) => {
    try {
      return await createAssignment(ctx.db, input, ctx.actorId, ctx.today);
    } catch (err) {
      if (err instanceof AssignmentBlockedError) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Assignment blocked — see the validation panel.",
          cause: err,
        });
      }
      throw err;
    }
  }),
});
