import { Badge } from "@/components/ui/badge";

type Status = "lapsed" | "expiring" | "valid" | null;

const MAP: Record<"lapsed" | "expiring" | "valid", { tone: "critical" | "warning" | "ok"; glyph: string; label: string }> = {
  lapsed: { tone: "critical", glyph: "✕", label: "Lapsed" },
  expiring: { tone: "warning", glyph: "▲", label: "Expiring" },
  valid: { tone: "ok", glyph: "✓", label: "Valid" },
};

/** Status is colour + icon + text label, every time (UXS §3, PRD §11). */
export function StatusChip({ status }: { status: Status }) {
  if (!status) {
    return (
      <Badge tone="neutral">
        <span aria-hidden="true">○</span> None
      </Badge>
    );
  }
  const { tone, glyph, label } = MAP[status];
  return (
    <Badge tone={tone}>
      <span aria-hidden="true">{glyph}</span> {label}
    </Badge>
  );
}
