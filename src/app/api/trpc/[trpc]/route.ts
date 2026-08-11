import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { getDb } from "@/db/pg";
import { SYSTEM_ACTOR_ID } from "@/db/schema";
import { appRouter } from "@/server/root";

// Slice 1 uses a fixed system actor; real identity/RBAC is Slice 2 (ADR-0011).
// `today` is read from the clock here, at the boundary — the gate itself stays
// pure and receives it via context.
const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => ({
      db: getDb(),
      actorId: SYSTEM_ACTOR_ID,
      today: new Date().toISOString().slice(0, 10),
    }),
  });

export { handler as GET, handler as POST };
