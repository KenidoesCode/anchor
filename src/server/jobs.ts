import { PgBoss } from "pg-boss";
import { getDb } from "@/db/pg";
import { runEscalationCascade } from "./escalation";
import { dispatchPending } from "./notifications";

/**
 * Background jobs on pg-boss (Postgres-backed, no separate broker).
 *
 * The escalation cascade runs **at least hourly** (ADR-0004 — not nightly), so
 * every stage fires within 60 minutes of its boundary (AC1.2) and the Director
 * count refreshes hourly (AC1.4). The job body is the tested pure function
 * `runEscalationCascade`; this module is only the scheduling shell and runs
 * against a live database, so it is not exercised by the unit suite.
 */
export const CASCADE_QUEUE = "escalation-cascade";

export async function startJobs(
  connectionString = process.env.DATABASE_URL,
): Promise<PgBoss> {
  if (!connectionString) throw new Error("DATABASE_URL is required to start jobs");
  const boss = new PgBoss(connectionString);
  await boss.start();

  await boss.work(CASCADE_QUEUE, async () => {
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);
    const result = await runEscalationCascade(db, today);
    await dispatchPending(db);
    return result;
  });

  // Hourly, anchored to the top of the hour.
  await boss.schedule(CASCADE_QUEUE, "0 * * * *");
  return boss;
}
