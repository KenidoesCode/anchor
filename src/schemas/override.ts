import { z } from "zod";
import { assignmentInput } from "./assignment";

/** Director override of a blocked assignment (F1 §3.2). Justification is mandatory. */
export const overrideInput = z.object({
  assignment: assignmentInput,
  justification: z.string().min(10, "A written justification is required."),
  requestedBy: z.string().uuid().optional(),
});

export type OverrideInput = z.infer<typeof overrideInput>;
