import { z } from "zod";
import { isoDate } from "./assignment";

/** Closing a renewal task by uploading the new, later-dated certificate (ADR-0008). */
export const closeRenewalInput = z.object({
  taskId: z.string().uuid(),
  registrationNumber: z.string().min(1),
  issueDate: isoDate,
  expiryDate: isoDate,
  documentKey: z.string().nullable().optional(),
  documentFilename: z.string().nullable().optional(),
});

export type CloseRenewalInput = z.infer<typeof closeRenewalInput>;
