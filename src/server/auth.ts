import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { Db } from "@/db/pg";
import * as s from "@/db/schema";

/**
 * Authentication. ASSUMPTION — UNRATIFIED — pending Q-P1-11: the auth mechanism
 * is email + password with an opaque server session here. Corppass/Singpass OIDC
 * and mandatory MFA (PRD §10.1) are not yet wired — no external IdP exists in
 * this environment. The AUTHORISATION layer (roles/scope, server-side, + RLS) is
 * the real, tested control and does not depend on how a user signs in.
 */

export const SESSION_COOKIE = "gs_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, derived] = stored.split(":");
  if (!salt || !derived) return false;
  const test = scryptSync(password, salt, 64);
  const original = Buffer.from(derived, "hex");
  return original.length === test.length && timingSafeEqual(original, test);
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: (typeof s.userRole.enumValues)[number];
  personId: string | null;
}

/** The actor id written to audit columns: the linked person, else the user. */
export function actorIdOf(user: AuthUser): string {
  return user.personId ?? user.id;
}

export async function authenticate(
  db: Db,
  email: string,
  password: string,
): Promise<AuthUser | null> {
  const rows = await db
    .select()
    .from(s.appUser)
    .where(and(eq(s.appUser.email, email), eq(s.appUser.active, true), isNull(s.appUser.deletedAt)))
    .limit(1);
  const u = rows[0];
  if (!u || !u.passwordHash || !verifyPassword(password, u.passwordHash)) return null;
  return { id: u.id, email: u.email, fullName: u.fullName, role: u.role, personId: u.personId };
}

export async function createSession(db: Db, userId: string, now = new Date()): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await db.insert(s.session).values({
    id: token,
    userId,
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
  });
  return token;
}

export async function resolveSession(
  db: Db,
  token: string | undefined,
  now = new Date(),
): Promise<AuthUser | null> {
  if (!token) return null;
  const rows = await db
    .select({
      id: s.appUser.id,
      email: s.appUser.email,
      fullName: s.appUser.fullName,
      role: s.appUser.role,
      personId: s.appUser.personId,
    })
    .from(s.session)
    .innerJoin(s.appUser, eq(s.session.userId, s.appUser.id))
    .where(
      and(
        eq(s.session.id, token),
        gt(s.session.expiresAt, now),
        eq(s.appUser.active, true),
        isNull(s.appUser.deletedAt),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function destroySession(db: Db, token: string | undefined): Promise<void> {
  if (!token) return;
  await db.delete(s.session).where(eq(s.session.id, token));
}
