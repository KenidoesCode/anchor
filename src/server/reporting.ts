import { sql } from "drizzle-orm";
import type { Db } from "@/db/pg";

/**
 * The number the product is judged on (PRD AC1.4): deployed personnel running
 * under a lapsed required certification, reconstructable for ANY past date and
 * stable under later corrections.
 *
 * Bitemporal:
 *  - `validDate` (D) is the real-world date asked about ("on 30 Jun, who was exposed?").
 *  - `knownAt` (T) is the transaction time whose belief to use; defaults to now
 *    (current belief). Reading history keyed by T means an in-place expiry
 *    correction made after T cannot change the answer for T (ADR-0013).
 *
 * Handles the flat all_of requirement shape Phase 1 uses; nested AND/OR
 * reconstruction reuses the gate evaluator and is deferred with M-phase work.
 */
export async function deployedUnderLapsedCert(
  db: Db,
  validDate: string,
  knownAt?: string,
): Promise<number> {
  const t = knownAt ?? null;
  const res = await db.execute(sql`
    SELECT count(DISTINCT d.id)::int AS n
    FROM deployment d
    JOIN assignment a ON a.id = d.assignment_id
    WHERE d.start_date <= ${validDate}
      AND (d.end_date IS NULL OR d.end_date >= ${validDate})
      AND d.created_at <= COALESCE(${t}::timestamptz, now())
      AND (d.deleted_at IS NULL OR d.deleted_at > COALESCE(${t}::timestamptz, now()))
      AND EXISTS (
        SELECT 1
        FROM requirement_group g
        JOIN requirement_item i ON i.group_id = g.id
        WHERE g.requirement_version_id = a.requirement_version_id
          -- no certificate of this required type was believed valid on D at T
          AND NOT EXISTS (
            SELECT 1 FROM certification_history h
            WHERE h.person_id = a.person_id
              AND h.certification_type_id = i.certification_type_id
              AND h.sys_from <= COALESCE(${t}::timestamptz, now())
              AND (h.sys_to IS NULL OR h.sys_to > COALESCE(${t}::timestamptz, now()))
              AND h.cert_deleted_at IS NULL
              AND h.issue_date <= ${validDate}
              AND h.expiry_date >= ${validDate}
          )
          -- but one that had lapsed by D was believed held at T
          AND EXISTS (
            SELECT 1 FROM certification_history h
            WHERE h.person_id = a.person_id
              AND h.certification_type_id = i.certification_type_id
              AND h.sys_from <= COALESCE(${t}::timestamptz, now())
              AND (h.sys_to IS NULL OR h.sys_to > COALESCE(${t}::timestamptz, now()))
              AND h.cert_deleted_at IS NULL
              AND h.expiry_date < ${validDate}
          )
      )
  `);

  const rows =
    (res as unknown as { rows?: Array<{ n: number | string }> }).rows ??
    (res as unknown as Array<{ n: number | string }>);
  return Number(rows[0]?.n ?? 0);
}
