import { join } from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getDb } from "./pg";

/** Apply generated SQL migrations. Idempotent (drizzle tracks applied ones). */
export async function runMigrations(): Promise<void> {
  await migrate(await getDb(), { migrationsFolder: join(process.cwd(), "drizzle") });
}

// CLI entry: `pnpm db:migrate`
if (process.argv[1] && process.argv[1].endsWith("migrate.ts")) {
  runMigrations()
    .then(() => {
      // eslint-disable-next-line no-console
      console.log("Migrations applied.");
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
