import { TRPCError } from "@trpc/server";
import { assignmentInput } from "@/schemas/assignment";
import {
  AssignmentBlockedError,
  createAssignment,
  validateAssignment,
} from "../assignment-service";
import { protectedProcedure, roleProcedure, router } from "../trpc";

export const assignmentRouter = router({
  /** Live gate for the validation panel (UXS §5.3). Any authenticated internal user. */
  validate: protectedProcedure.input(assignmentInput).query(({ ctx, input }) =>
    validateAssignment(ctx.db, input, ctx.today),
  ),

  /**
   * Persist an assignment + its deployment. Only a Deployment Coordinator or
   * Director may assign (UXF §2). The server re-runs the gate and rejects a
   * Blocked outcome (AC1.1); the disabled Save button is only presentation.
   */
  create: roleProcedure("deployment_coordinator", "director")
    .input(assignmentInput)
    .mutation(async ({ ctx, input }) => {
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
