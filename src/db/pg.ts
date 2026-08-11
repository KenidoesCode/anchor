import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/** The database handle type used across the server and in tests. */
export type Db = NodePgDatabase<typeof schema>;

let pool: Pool | undefined;

/** Lazily-created application database client (node-postgres → AWS RDS in prod). */
export function getDb(): Db {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    pool = new Pool({ connectionString: url });
  }
  return drizzle(pool, { schema });
}
