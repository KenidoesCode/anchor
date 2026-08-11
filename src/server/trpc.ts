import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { AuthUser } from "@/server/auth";
import { actorIdOf } from "@/server/auth";
import type { Db } from "@/db/pg";

/**
 * Request context. Authentication resolves `user` from the session cookie
 * (Slice 2); role/scope authorisation is enforced server-side below, with
 * Postgres RLS as the second layer. `today` is the server clock, injected so
 * the gate stays deterministic and testable.
 */
export interface Context {
  db: Db;
  user: AuthUser | null;
  today: string;
}

const t = initTRPC.context<Context>().create({ transformer: superjson });

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;

/** Open procedure — used only where no identity is required. */
export const publicProcedure = t.procedure;

/** Requires an authenticated user; exposes `user` and `actorId` to the resolver. */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in required." });
  }
  return next({ ctx: { ...ctx, user: ctx.user, actorId: actorIdOf(ctx.user) } });
});

/** Requires the user to hold one of the given roles (UXF §2.1). */
export function roleProcedure(...roles: AuthUser["role"][]) {
  return protectedProcedure.use(({ ctx, next }) => {
    if (!roles.includes(ctx.user.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `This action requires one of: ${roles.join(", ")}.`,
      });
    }
    return next({ ctx });
  });
}
