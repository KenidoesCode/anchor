import type { GateOutcome } from "@/domain/gate";
import { cn } from "@/lib/utils";

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
  confirmed: "text-state-ok",
  conditional: "text-state-warning",
  blocked: "text-state-critical",
};

/**
 * Pre-filtered, pre-sorted officer list (UXF §3 step 4, UXS §5.3). Ineligible
 * (blocked) officers are shown greyed and are not selectable, with the reason
 * INLINE (ADR-0010) — never hidden, never on hover.
 */
export function OfficerSelector({ officers, selectedId, onSelect }: Props) {
  if (officers.length === 0) {
    return <p className="text-xs text-ink-muted">No officers to show. Choose a role and start date.</p>;
  }

  return (
    <ul className="overflow-hidden rounded-sm border border-rule" role="listbox" aria-label="Officers">
      {officers.map((o) => {
        const ineligible = o.outcome === "blocked";
        return (
          <li key={o.personId} role="option" aria-selected={o.personId === selectedId}>
            <button
              type="button"
              disabled={ineligible}
              aria-selected={o.personId === selectedId}
              onClick={() => !ineligible && onSelect(o.personId)}
              className={cn(
                "flex w-full items-center gap-2.5 border-b border-rule px-3 py-2.5 text-left last:border-b-0",
                ineligible
                  ? "cursor-not-allowed bg-[#fafbfb] text-ink-muted"
                  : "cursor-pointer bg-surface hover:bg-canvas",
                o.personId === selectedId && "bg-[#eef4fb] hover:bg-[#eef4fb]",
              )}
            >
              <span aria-hidden="true" className={cn("w-4 text-center font-bold", glyphColour[o.outcome])}>
                {glyph[o.outcome]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-semibold">{o.fullName}</span>
                {o.reason && <span className="text-xs text-ink-muted"> · {o.reason}</span>}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
