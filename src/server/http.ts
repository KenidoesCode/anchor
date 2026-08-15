import { getDb } from "@/db/pg";
import { type AuthUser, resolveSession, SESSION_COOKIE } from "./auth";

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

/** Resolve the signed-in user for a raw route handler request (or null). */
export async function userFromRequest(req: Request): Promise<AuthUser | null> {
  return resolveSession(await getDb(), readCookie(req, SESSION_COOKIE));
}
