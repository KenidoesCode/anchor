import { z } from "zod";
import { isoDate } from "@/schemas/assignment";
import {
  addCertification,
  createPerson,
  getPersonMasked,
  unmaskNationalId,
} from "../person-service";
import { protectedProcedure, roleProcedure, router } from "../trpc";

const ONBOARD_ROLES = ["training_admin", "director"] as const;
const INTERNAL = [
  "director",
  "deployment_coordinator",
  "lead_auditor",
  "auditor",
  "training_admin",
  "qehs_consultant",
  "finance",
] as const;

export const personRouter = router({
  /** F6 onboarding — create a person; national identifier is encrypted at rest. */
  create: roleProcedure(...ONBOARD_ROLES)
    .input(
      z.object({
        fullName: z.string().min(1),
        employmentStatus: z.enum(["employed", "associate", "inactive"]).optional(),
        homeBase: z.string().nullable().optional(),
        languages: z.array(z.string()).optional(),
        nationalId: z.string().nullable().optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      createPerson(
        ctx.db,
        {
          fullName: input.fullName,
          ...(input.employmentStatus ? { employmentStatus: input.employmentStatus } : {}),
          homeBase: input.homeBase ?? null,
          languages: input.languages ?? [],
          nationalId: input.nationalId ?? null,
        },
        ctx.actorId,
      ),
    ),

  addCertification: roleProcedure(...ONBOARD_ROLES)
    .input(
      z.object({
        personId: z.string().uuid(),
        certificationTypeId: z.string().uuid(),
        registrationNumber: z.string().min(1),
        issueDate: isoDate,
        expiryDate: isoDate,
        documentKey: z.string().nullable().optional(),
        documentFilename: z.string().nullable().optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      addCertification(
        ctx.db,
        {
          personId: input.personId,
          certificationTypeId: input.certificationTypeId,
          registrationNumber: input.registrationNumber,
          issueDate: input.issueDate,
          expiryDate: input.expiryDate,
          documentKey: input.documentKey ?? null,
          documentFilename: input.documentFilename ?? null,
        },
        ctx.actorId,
      ),
    ),

  /** Masked-by-default person record. */
  get: roleProcedure(...INTERNAL)
    .input(z.object({ personId: z.string().uuid() }))
    .query(({ ctx, input }) => getPersonMasked(ctx.db, input.personId)),

  /** Unmask a national identifier — reason-required, logged (PRD §10.2). Admin/Director only. */
  unmaskNationalId: roleProcedure(...ONBOARD_ROLES)
    .input(z.object({ personId: z.string().uuid(), reason: z.string().min(5) }))
    .mutation(({ ctx, input }) => unmaskNationalId(ctx.db, input.personId, input.reason, ctx.actorId)),
});
