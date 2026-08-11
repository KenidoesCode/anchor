import { desc } from "drizzle-orm";
import type { Db } from "@/db/pg";
import * as s from "@/db/schema";

export interface ActivityInput {
  actorId: string;
  action: string;
  entity: string;
  entityId?: string | null;
  detail?: string | null;
  reason?: string | null;
}

/**
 * Append a row to the immutable activity log (PRD §10.5). Every mutation of
 * consequence, every override, and every personal-data unmasking calls this.
 * The table has no update/delete columns by design — append-only.
 */
export async function logActivity(db: Db, input: ActivityInput): Promise<void> {
  await db.insert(s.eventLog).values({
    actorId: input.actorId,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId ?? null,
    detail: input.detail ?? null,
    reason: input.reason ?? null,
  });
}

export async function recentActivity(db: Db, limit = 100) {
  return db
    .select()
    .from(s.eventLog)
    .orderBy(desc(s.eventLog.occurredAt))
    .limit(limit);
}
