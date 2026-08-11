import type { GateOutcome, GateReason } from "@/domain/gate";
import { cn } from "@/lib/utils";

export interface PanelResult {
  outcome: GateOutcome;
  monitored: boolean;
  reasons: GateReason[];
}

interface Props {
  result: PanelResult | undefined;
  loading: boolean;
  officerName: string | undefined;
}

const shell = "rounded-sm border border-l-4 p-[18px] transition-opacity duration-150";

/**
 * The validation panel (UXS §5.3) — three determinations, plus an idle state.
 * A machine returning a determination: no animation beyond a 160ms opacity
 * transition. Status is colour + icon + text, never colour alone.
 */
export function ValidationPanel({ result, loading, officerName }: Props) {
  if (!officerName) {
    return (
      <section className={cn(shell, "border-l-rule text-ink-muted")} aria-live="polite">
        <p>Select an officer to validate the assignment.</p>
      </section>
    );
  }

  if (loading || !result) {
    return (
      <section className={cn(shell, "border-l-rule text-ink-muted")} aria-live="polite">
        <p>Validating {officerName}…</p>
      </section>
    );
  }

  if (result.outcome === "blocked") {
    return (
      <section className={cn(shell, "border-l-state-critical")} aria-live="polite">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-state-critical">
          <span aria-hidden="true">✕</span> Assignment blocked
        </h2>
        {result.reasons.map((r, i) => (
          <p key={i} className="mb-2.5">
            {r.message}
          </p>
        ))}
        <p role="note" className="text-[13px] font-semibold text-state-critical">
          Director override is a later slice (ADR-0011); the block is the control today.
        </p>
      </section>
    );
  }

  if (result.outcome === "conditional") {
    return (
      <section className={cn(shell, "border-l-state-warning")} aria-live="polite">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-state-warning">
          <span aria-hidden="true">▲</span> Allowed — renewal required first
        </h2>
        {result.reasons.map((r, i) => (
          <p key={i} className="mb-2.5">
            {r.message}
          </p>
        ))}
        <p>Renewal task will be created on save.</p>
      </section>
    );
  }

  return (
    <section className={cn(shell, "border-l-state-ok")} aria-live="polite">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-state-ok">
        <span aria-hidden="true">✓</span> Assignment confirmed
      </h2>
      {result.reasons.map((r, i) => (
        <p key={i} className="mb-2.5">
          {r.message}
        </p>
      ))}
      {/* ASSUMPTION — UNRATIFIED — pending Q-P1-7 (ADR-0005): this
          Confirmed-with-monitoring copy only appears because of the open-ended
          rule in gate.ts, which Greensafe has not confirmed. */}
      {result.monitored && (
        <p>Open-ended posting — expiry will be monitored by the renewal cascade.</p>
      )}
    </section>
  );
}
