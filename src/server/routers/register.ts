import { certificationsBoard, deploymentsView, registerPeople } from "../register-service";
import { roleProcedure, router } from "../trpc";

// Internal staff who may read the registers (not deployed_officer/client_user).
const INTERNAL = [
  "director",
  "deployment_coordinator",
  "lead_auditor",
  "auditor",
  "training_admin",
  "qehs_consultant",
  "finance",
] as const;

export const registerRouter = router({
  people: roleProcedure(...INTERNAL).query(({ ctx }) => registerPeople(ctx.db, ctx.today)),
  certifications: roleProcedure(...INTERNAL).query(({ ctx }) => certificationsBoard(ctx.db, ctx.today)),
  deployments: roleProcedure(...INTERNAL).query(({ ctx }) => deploymentsView(ctx.db, ctx.today)),
});
