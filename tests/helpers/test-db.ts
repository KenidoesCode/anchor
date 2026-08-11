import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Db } from "@/db/pg";
import * as schema from "@/db/schema";

/**
 * An in-process Postgres (pglite) with the real generated migrations applied.
 * Runs the identical SQL a production Postgres would, with no external server —
 * so integration tests are hermetic and CI-friendly.
 */
export async function makeTestDb(): Promise<{ db: Db; close: () => Promise<void> }> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return { db: db as unknown as Db, close: () => client.close() };
}
