import type { GateOutcome } from "@/domain/gate";

export interface OfficerOption {
  personId: string;
  fullName: string;
  outcome: GateOutcome;
  monitored: boolean;
  reason: string;
}

interface Props {
  officers: OfficerOption[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}

const glyph: Record<GateOutcome, string> = {
  confirmed: "✓",
  conditional: "▲",
  blocked: "✕",
};
const glyphColour: Record<GateOutcome, string> = {
  confirmed: "var(--state-ok)",
  conditional: "var(--state-warning)",
  blocked: "var(--state-critical)",
};

/**
 * Pre-filtered, pre-sorted officer list (UXF §3 step 4, UXS §5.3). Ineligible
 * (blocked) officers are shown greyed and are not selectable, with the reason
 * INLINE (ADR-0010) — never hidden, never on hover.
 */
export function OfficerSelector({ officers, selectedId, onSelect }: Props) {
  if (officers.length === 0) {
    return <p className="hint">No officers to show. Choose a role and start date.</p>;
  }

  return (
    <ul className="officers" role="listbox" aria-label="Officers">
      {officers.map((o) => {
        const ineligible = o.outcome === "blocked";
        return (
          <li key={o.personId} role="option" aria-selected={o.personId === selectedId}>
            <button
              type="button"
              className={`officer${ineligible ? " ineligible" : ""}`}
              aria-selected={o.personId === selectedId}
              disabled={ineligible}
              onClick={() => !ineligible && onSelect(o.personId)}
            >
              <span className="glyph" aria-hidden="true" style={{ color: glyphColour[o.outcome] }}>
                {glyph[o.outcome]}
              </span>
              <span className="who">
                <span className="name">{o.fullName}</span>
                {o.reason && <span className="reason"> · {o.reason}</span>}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
