import type { Db } from "@/db/pg";
import type { AuthUser } from "@/server/auth";
import { appRouter } from "@/server/root";
import { createCallerFactory } from "@/server/trpc";

/** Build a tRPC caller with a given authenticated user (or null) and db. */
export function callerFor(db: Db, user: AuthUser | null, today = "2026-08-11") {
  return createCallerFactory(appRouter)({ db, user, today });
}

export function fakeUser(role: AuthUser["role"], overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    email: `${role}@greensafe.test`,
    fullName: role,
    role,
    personId: null,
    ...overrides,
  };
}
