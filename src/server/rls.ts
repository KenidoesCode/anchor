import { sql } from "drizzle-orm";
import type { Db } from "@/db/pg";

/**
 * Run `fn` inside a transaction with the RLS session GUCs set to the caller's
 * identity, so the row-level policies (migration 0003) apply. `set_config(…,
 * true)` scopes the setting to the transaction. Use this for any read/write that
 * must respect scope; production connects as a non-owner role so the policies
 * bind.
 */
export async function withActor<T>(
  db: Db,
  actor: { actorId: string; role: string },
  fn: (tx: Db) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.actor_id', ${actor.actorId}, true)`);
    await tx.execute(sql`select set_config('app.user_role', ${actor.role}, true)`);
    return fn(tx as unknown as Db);
  });
}
