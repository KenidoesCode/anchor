import type { Db } from "@/db/pg";
import * as s from "@/db/schema";
import { SETTING_KEYS } from "./config";

/**
 * Ships the system's DEFAULT configuration (ADR-0017). This is real production
 * config, not fictional seed data — an idempotent installer run at bootstrap.
 * Every value here is intended to be changed by Greensafe through the admin
 * surface; the numbers below are defaults derived from UXF §4 / PRD §5.1, not
 * hardcoded business rules.
 */
export async function installDefaultConfig(db: Db, actorId: string): Promise<void> {
  const settings: { key: string; value: unknown; description: string }[] = [
    { key: SETTING_KEYS.overlapEnabled, value: true, description: "Block a deployment that overlaps an existing one." },
    { key: SETTING_KEYS.overlapInclusive, value: true, description: "Treat touching intervals as overlapping." },
    { key: SETTING_KEYS.resolveAsOf, value: "today", description: "Resolve the requirement version as-of 'today' or 'deployment_start' (UNRATIFIED, Q-P1-14)." },
    { key: SETTING_KEYS.directorFallback, value: true, description: "When a stage's target relationship is null, notify the Director." },
  ];
  for (const st of settings) {
    await db
      .insert(s.appSetting)
      .values({ key: st.key, value: st.value, description: st.description, createdBy: actorId, updatedBy: actorId })
      .onConflictDoNothing({ target: s.appSetting.key });
  }

  const stages: {
    stageKey: string;
    daysBefore: number;
    notifyTarget: "holder" | "line_manager" | "account_owner" | "director";
    channel: "in_app" | "email" | "sms";
    sortOrder: number;
  }[] = [
    { stageKey: "d90", daysBefore: 90, notifyTarget: "holder", channel: "in_app", sortOrder: 0 },
    { stageKey: "d60", daysBefore: 60, notifyTarget: "line_manager", channel: "email", sortOrder: 1 },
    { stageKey: "d30", daysBefore: 30, notifyTarget: "account_owner", channel: "email", sortOrder: 2 },
    { stageKey: "d7", daysBefore: 7, notifyTarget: "director", channel: "sms", sortOrder: 3 },
    { stageKey: "expiry", daysBefore: 0, notifyTarget: "director", channel: "email", sortOrder: 4 },
  ];
  for (const stage of stages) {
    await db
      .insert(s.escalationStageConfig)
      .values({ ...stage, createdBy: actorId, updatedBy: actorId })
      .onConflictDoNothing({ target: s.escalationStageConfig.stageKey });
  }
}
