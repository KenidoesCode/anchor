import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/** The database handle type used across the server and in tests. */
export type Db = NodePgDatabase<typeof schema>;

let pool: Pool | undefined;

/** Lazily-created application database client (node-postgres → Neon/RDS in prod). */
export function getDb(): Db {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    // Hosted Postgres (Neon, RDS) requires TLS; local dev does not. Detect by host.
    const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url) || url.includes("host=/");
    const forceSsl = process.env.GS_PG_SSL === "1";
    pool = new Pool({
      connectionString: url,
      ...(isLocal && !forceSsl ? {} : { ssl: { rejectUnauthorized: false } }),
    });
  }
  return drizzle(pool, { schema });
}
