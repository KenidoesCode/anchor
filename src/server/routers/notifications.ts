import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import * as s from "@/db/schema";
import { protectedProcedure, router } from "../trpc";

/** Rows addressed to the current user: to them by person, or to their role. */
function addressedToMe(personId: string | null, role: string) {
  const byRole = eq(s.notification.recipientRole, role);
  return personId ? or(eq(s.notification.recipientId, personId), byRole) : byRole;
}

export const notificationsRouter = router({
  /** Unread in-app notifications for the bell, grouped-friendly (newest first). */
  unread: protectedProcedure.query(({ ctx }) =>
    ctx.db
      .select({
        id: s.notification.id,
        subject: s.notification.subject,
        relatedEntity: s.notification.relatedEntity,
        relatedId: s.notification.relatedId,
        createdAt: s.notification.createdAt,
      })
      .from(s.notification)
      .where(
        and(
          isNull(s.notification.readAt),
          isNull(s.notification.deletedAt),
          addressedToMe(ctx.user.personId, ctx.user.role),
        ),
      )
      .orderBy(desc(s.notification.createdAt))
      .limit(50),
  ),

  markRead: protectedProcedure
    .input(z.object({ id: z.string().uuid().optional() }))
    .mutation(async ({ ctx, input }) => {
      const mine = addressedToMe(ctx.user.personId, ctx.user.role);
      await ctx.db
        .update(s.notification)
        .set({ readAt: sql`now()` })
        .where(
          input.id
            ? and(eq(s.notification.id, input.id), mine)
            : and(isNull(s.notification.readAt), mine),
        );
      return { ok: true };
    }),
});
