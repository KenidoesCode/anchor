import { assignmentRouter } from "./routers/assignment";
import { catalogueRouter } from "./routers/catalogue";
import { officersRouter } from "./routers/officers";
import { overrideRouter } from "./routers/override";
import { overviewRouter } from "./routers/overview";
import { renewalRouter } from "./routers/renewal";
import { activityRouter, sessionRouter } from "./routers/session";
import { router } from "./trpc";

export const appRouter = router({
  session: sessionRouter,
  activity: activityRouter,
  assignment: assignmentRouter,
  officers: officersRouter,
  catalogue: catalogueRouter,
  override: overrideRouter,
  renewal: renewalRouter,
  overview: overviewRouter,
});

export type AppRouter = typeof appRouter;
