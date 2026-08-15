import { NextResponse } from "next/server";
import { runMigrations } from "@/db/migrate";
import { getDb } from "@/db/pg";
import * as s from "@/db/schema";
import { seedDemo } from "../../../../seed/seed";

// Node runtime (needs node-postgres). Never statically rendered.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One-shot bootstrap for a HOSTED DEMO: apply migrations, then load the
 * fictional demo scenario IF the database is empty. Idempotent — safe to hit
 * more than once.
 *
 * Guarded so it can never run against a real production database:
 *  - disabled unless GS_ALLOW_BOOTSTRAP=1
 *  - if GS_BOOTSTRAP_TOKEN is set, ?token= must match
 *  - seeding only happens when GS_DEMO_SEED=1 AND the DB has no users
 *
 * Usage after deploy:  GET /api/bootstrap?token=<GS_BOOTSTRAP_TOKEN>
 */
export async function GET(req: Request) {
  if (process.env.GS_ALLOW_BOOTSTRAP !== "1") {
    return NextResponse.json({ error: "Bootstrap is disabled." }, { status: 404 });
  }
  const token = process.env.GS_BOOTSTRAP_TOKEN;
  const provided = new URL(req.url).searchParams.get("token");
  if (token && provided !== token) {
    return NextResponse.json({ error: "Invalid token." }, { status: 401 });
  }

  try {
    await runMigrations();

    const db = await getDb();
    const existing = await db.select({ id: s.appUser.id }).from(s.appUser).limit(1);
    let seeded = false;
    if (existing.length === 0 && process.env.GS_DEMO_SEED === "1") {
      await seedDemo(db);
      seeded = true;
    }
    const users = await db.select({ email: s.appUser.email }).from(s.appUser);

    return NextResponse.json({
      migrated: true,
      seeded,
      users: users.length,
      note: seeded
        ? "Demo data loaded. Sign in at /signin (karu@greensafe.test / greensafe)."
        : existing.length > 0
          ? "Already had data; skipped seed."
          : "Migrated. Set GS_DEMO_SEED=1 to load demo data.",
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Bootstrap failed.", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
