import { z } from "zod";

/** ISO calendar date 'YYYY-MM-DD'. One shared definition (CLAUDE.md: one Zod schema per concept). */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a date as YYYY-MM-DD");

/**
 * Input to the assignment gate (UXF §3). `now` is deliberately NOT here — it is
 * supplied by the server context, never by the client, so the determination
 * cannot be spoofed.
 */
export const assignmentInput = z
  .object({
    personId: z.string().uuid(),
    roleId: z.string().uuid(),
    organisationId: z.string().uuid(),
    siteId: z.string().uuid(),
    startDate: isoDate,
    endDate: isoDate.nullable().default(null),
    chargeRate: z.number().positive().optional(),
  })
  .refine((v) => v.endDate === null || v.endDate >= v.startDate, {
    message: "End date cannot be before the start date.",
    path: ["endDate"],
  });

export type AssignmentInput = z.infer<typeof assignmentInput>;
