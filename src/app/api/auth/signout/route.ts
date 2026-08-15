import { NextResponse } from "next/server";
import { getDb } from "@/db/pg";
import { destroySession, SESSION_COOKIE } from "@/server/auth";

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export async function POST(req: Request) {
  const token = readCookie(req, SESSION_COOKIE);
  await destroySession(await getDb(), token);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
