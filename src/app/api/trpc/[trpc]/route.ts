import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { getDb } from "@/db/pg";
import { resolveSession, SESSION_COOKIE } from "@/server/auth";
import { appRouter } from "@/server/root";

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

const handler = async (req: Request) => {
  const db = await getDb();
  const user = await resolveSession(db, readCookie(req, SESSION_COOKIE));
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => ({
      db,
      user,
      today: new Date().toISOString().slice(0, 10),
    }),
  });
};

export { handler as GET, handler as POST };
