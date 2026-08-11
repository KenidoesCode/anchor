import { asc, isNull } from "drizzle-orm";
import { z } from "zod";
import * as s from "@/db/schema";
import type { GateOutcome } from "@/domain/gate";
import { isoDate } from "@/schemas/assignment";
import { runGate } from "../assignment-service";
import { protectedProcedure, router } from "../trpc";

/** Sort so eligible officers surface first; ineligible shown, greyed (UXF §3, UXS §5.3). */
const order: Record<GateOutcome, number> = { confirmed: 0, conditional: 1, blocked: 2 };

export const officersRouter = router({
  /**
   * The pre-filtered, pre-sorted officer selector for a role and period.
   * Ineligible officers are returned too (greyed, with the reason inline —
   * ADR-0010), never hidden: the coordinator must see who was considered and why.
   */
  forAssignment: protectedProcedure
    .input(
      z.object({
        roleId: z.string().uuid(),
        startDate: isoDate,
        endDate: isoDate.nullable().default(null),
      }),
    )
    .query(async ({ ctx, input }) => {
      const people = await ctx.db
        .select({ id: s.person.id, fullName: s.person.fullName })
        .from(s.person)
        .where(isNull(s.person.deletedAt))
        .orderBy(asc(s.person.fullName));

      const evaluated = await Promise.all(
        people.map(async (p) => {
          const result = await runGate(
            ctx.db,
            {
              personId: p.id,
              roleId: input.roleId,
              startDate: input.startDate,
              endDate: input.endDate,
            },
            ctx.today,
          );
          return {
            personId: p.id,
            fullName: p.fullName,
            outcome: result.outcome,
            monitored: result.monitored,
            reason: result.reasons[0]?.message ?? "",
          };
        }),
      );

      return evaluated.sort(
        (a, b) => order[a.outcome] - order[b.outcome] || a.fullName.localeCompare(b.fullName),
      );
    }),
});
