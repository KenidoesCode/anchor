import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import type { Db } from "@/db/pg";

/**
 * Request context. `actorId` and role/scope enforcement are stubbed in Slice 1
 * (a fixed coordinator actor); real identity, RBAC, scope and RLS arrive in
 * Slice 2 (ADR-0011). `today` is the server clock, injected so the gate stays
 * deterministic and testable.
 */
export interface Context {
  db: Db;
  actorId: string;
  today: string;
}

const t = initTRPC.context<Context>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;
