import { recentActivity } from "../activity";
import { protectedProcedure, roleProcedure, router } from "../trpc";

export const sessionRouter = router({
  /** Who am I — used by the client shell to render role-appropriate navigation. */
  me: protectedProcedure.query(({ ctx }) => ({
    email: ctx.user.email,
    fullName: ctx.user.fullName,
    role: ctx.user.role,
  })),
});

export const activityRouter = router({
  /** The append-only activity log (PRD §10.5). Director-only. */
  recent: roleProcedure("director").query(({ ctx }) => recentActivity(ctx.db, 200)),
});
