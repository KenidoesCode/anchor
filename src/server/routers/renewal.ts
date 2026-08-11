import { closeRenewalInput } from "@/schemas/renewal";
import { closeRenewalTask, openRenewalTasks } from "../renewal-service";
import { roleProcedure, router } from "../trpc";

const RENEWAL_ROLES = ["deployment_coordinator", "training_admin", "director"] as const;

export const renewalRouter = router({
  listOpen: roleProcedure(...RENEWAL_ROLES).query(({ ctx }) => openRenewalTasks(ctx.db)),

  close: roleProcedure(...RENEWAL_ROLES)
    .input(closeRenewalInput)
    .mutation(({ ctx, input }) =>
      closeRenewalTask(
        ctx.db,
        input.taskId,
        {
          registrationNumber: input.registrationNumber,
          issueDate: input.issueDate,
          expiryDate: input.expiryDate,
          documentKey: input.documentKey ?? null,
          documentFilename: input.documentFilename ?? null,
        },
        ctx.actorId,
        ctx.today,
      ),
    ),
});
