import { assignmentRouter } from "./routers/assignment";
import { catalogueRouter } from "./routers/catalogue";
import { officersRouter } from "./routers/officers";
import { activityRouter, sessionRouter } from "./routers/session";
import { router } from "./trpc";

export const appRouter = router({
  session: sessionRouter,
  activity: activityRouter,
  assignment: assignmentRouter,
  officers: officersRouter,
  catalogue: catalogueRouter,
});

export type AppRouter = typeof appRouter;
