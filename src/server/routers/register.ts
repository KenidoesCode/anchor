import { certificationsBoard, deploymentsView, registerPeople } from "../register-service";
import { withActor } from "../rls";
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

// The register reads run inside withActor so the RLS policies (migration 0003)
// are the genuine second layer here, not just proven-but-unused. NOTE: withActor
// is threaded on these scope-sensitive reads; it is NOT yet on every procedure
// (see the report / DECISIONS ADR-0018). RBAC remains the primary tested control.
export const registerRouter = router({
  people: roleProcedure(...INTERNAL).query(({ ctx }) =>
    withActor(ctx.db, { actorId: ctx.actorId, role: ctx.user.role }, (tx) => registerPeople(tx, ctx.today)),
  ),
  certifications: roleProcedure(...INTERNAL).query(({ ctx }) =>
    withActor(ctx.db, { actorId: ctx.actorId, role: ctx.user.role }, (tx) => certificationsBoard(tx, ctx.today)),
  ),
  deployments: roleProcedure(...INTERNAL).query(({ ctx }) =>
    withActor(ctx.db, { actorId: ctx.actorId, role: ctx.user.role }, (tx) => deploymentsView(tx, ctx.today)),
  ),
});
