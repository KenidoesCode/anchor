import { join } from "node:path";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/** The database handle type used across the server and in tests. */
export type Db = NodePgDatabase<typeof schema>;

let cached: Db | undefined;
let initPromise: Promise<Db> | undefined;

/**
 * The application database.
 *
 *  - If DATABASE_URL is set → real Postgres (Neon/RDS), TLS auto-enabled.
 *  - If NOT set → a self-contained IN-MEMORY Postgres (pglite), migrated and
 *    seeded with the fictional demo scenario on first use. This is what makes
 *    the Vercel deploy work with zero configuration: no external database, no
 *    env vars. NOTE: in-memory data lives per running instance and resets on a
 *    cold start — fine for a single-user demo, not for real data.
 *
 * Async because the in-memory engine initialises (WASM + migrate + seed) at
 * first call; the result is cached, so subsequent calls are instant.
 */
export function getDb(): Promise<Db> {
  if (cached) return Promise.resolve(cached);
  if (!initPromise) initPromise = init();
  return initPromise;
}

async function init(): Promise<Db> {
  const url = process.env.DATABASE_URL;

  if (url) {
    const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url) || url.includes("host=/");
    const forceSsl = process.env.GS_PG_SSL === "1";
    const pool = new Pool({
      connectionString: url,
      ...(isLocal && !forceSsl ? {} : { ssl: { rejectUnauthorized: false } }),
    });
    cached = drizzle(pool, { schema });
    return cached;
  }

  // In-memory demo database — zero external dependencies.
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle: drizzlePglite } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const client = new PGlite();
  const db = drizzlePglite(client, { schema }) as unknown as Db;
  await migrate(db as never, { migrationsFolder: join(process.cwd(), "drizzle") });
  const { seedDemo } = await import("../../seed/seed");
  await seedDemo(db);
  cached = db;
  return cached;
}
