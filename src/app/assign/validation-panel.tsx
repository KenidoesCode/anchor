import type { GateOutcome, GateReason } from "@/domain/gate";

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

/**
 * The validation panel (UXS §5.3) — three determinations, plus an idle state.
 * A machine returning a determination: no animation beyond a 160ms opacity
 * transition (handled in CSS). Status is colour + icon + text, never colour alone.
 */
export function ValidationPanel({ result, loading, officerName }: Props) {
  if (!officerName) {
    return (
      <section className="panel panel--idle" aria-live="polite">
        <p>Select an officer to validate the assignment.</p>
      </section>
    );
  }

  if (loading || !result) {
    return (
      <section className="panel panel--idle" aria-live="polite">
        <p>Validating {officerName}…</p>
      </section>
    );
  }

  if (result.outcome === "blocked") {
    return (
      <section className="panel panel--blocked" aria-live="polite">
        <h2>
          <span className="glyph" aria-hidden="true">
            ✕
          </span>
          Assignment blocked
        </h2>
        {result.reasons.map((r, i) => (
          <p key={i}>{r.message}</p>
        ))}
        <p className="btn-note" role="note">
          Director override is a later slice (ADR-0011); the block is the control today.
        </p>
      </section>
    );
  }

  if (result.outcome === "conditional") {
    return (
      <section className="panel panel--conditional" aria-live="polite">
        <h2>
          <span className="glyph" aria-hidden="true">
            ▲
          </span>
          Allowed — renewal required first
        </h2>
        {result.reasons.map((r, i) => (
          <p key={i}>{r.message}</p>
        ))}
        <p>Renewal task will be created on save.</p>
      </section>
    );
  }

  return (
    <section className="panel panel--confirmed" aria-live="polite">
      <h2>
        <span className="glyph" aria-hidden="true">
          ✓
        </span>
        Assignment confirmed
      </h2>
      {result.reasons.map((r, i) => (
        <p key={i}>{r.message}</p>
      ))}
      {result.monitored && <p>Open-ended posting — expiry will be monitored by the renewal cascade.</p>}
    </section>
  );
}
