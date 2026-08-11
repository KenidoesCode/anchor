import { assignmentRouter } from "./routers/assignment";
import { router } from "./trpc";

export const appRouter = router({
  assignment: assignmentRouter,
});

export type AppRouter = typeof appRouter;
