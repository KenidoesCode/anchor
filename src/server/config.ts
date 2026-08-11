import { asc, eq } from "drizzle-orm";
import type { Db } from "@/db/pg";
import * as s from "@/db/schema";

/**
 * Configuration accessors (ADR-0017). Every Group-B threshold, interval,
 * recipient and rule switch is DATA read through here — never a constant in
 * application logic. Changing a number is an UPDATE, not a deploy. Tests read
 * these getters rather than hardcoding expected values.
 */

/** Scalar rule switches, with their seeded defaults documented in one place. */
export const SETTING_KEYS = {
  overlapEnabled: "gate.overlapEnabled",
  overlapInclusive: "gate.overlapInclusive",
  /** 'today' (server clock) | 'deployment_start'. UNRATIFIED — Q-P1-14 / ADR-0015. */
  resolveAsOf: "gate.resolveAsOf",
  /** When a stage's target relationship is null, fall back to Director. */
  directorFallback: "escalation.directorFallback",
} as const;

export async function getSetting<T>(db: Db, key: string, fallback: T): Promise<T> {
  const rows = await db
    .select({ value: s.appSetting.value })
    .from(s.appSetting)
    .where(eq(s.appSetting.key, key))
    .limit(1);
  const row = rows[0];
  return row ? (row.value as T) : fallback;
}

export interface GateConfig {
  overlapEnabled: boolean;
  overlapInclusive: boolean;
  resolveAsOf: "today" | "deployment_start";
}

export async function getGateConfig(db: Db): Promise<GateConfig> {
  const [overlapEnabled, overlapInclusive, resolveAsOf] = await Promise.all([
    getSetting<boolean>(db, SETTING_KEYS.overlapEnabled, true),
    getSetting<boolean>(db, SETTING_KEYS.overlapInclusive, true),
    getSetting<"today" | "deployment_start">(db, SETTING_KEYS.resolveAsOf, "today"),
  ]);
  return { overlapEnabled, overlapInclusive, resolveAsOf };
}

export interface EscalationStage {
  stageKey: string;
  daysBefore: number;
  notifyTarget: "holder" | "line_manager" | "account_owner" | "director";
  channel: "in_app" | "email" | "sms";
  sortOrder: number;
}

/** The escalation cascade's stages, ordered — read by the cascade job (ADR-0017). */
export async function getEscalationStages(db: Db): Promise<EscalationStage[]> {
  return db
    .select({
      stageKey: s.escalationStageConfig.stageKey,
      daysBefore: s.escalationStageConfig.daysBefore,
      notifyTarget: s.escalationStageConfig.notifyTarget,
      channel: s.escalationStageConfig.channel,
      sortOrder: s.escalationStageConfig.sortOrder,
    })
    .from(s.escalationStageConfig)
    .where(eq(s.escalationStageConfig.active, true))
    .orderBy(asc(s.escalationStageConfig.sortOrder));
}

export async function getDirectorFallback(db: Db): Promise<boolean> {
  return getSetting<boolean>(db, SETTING_KEYS.directorFallback, true);
}
