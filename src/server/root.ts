import { assignmentRouter } from "./routers/assignment";
import { catalogueRouter } from "./routers/catalogue";
import { officersRouter } from "./routers/officers";
import { router } from "./trpc";

export const appRouter = router({
  assignment: assignmentRouter,
  officers: officersRouter,
  catalogue: catalogueRouter,
});

export type AppRouter = typeof appRouter;
