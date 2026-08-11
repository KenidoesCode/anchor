import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Status chip (UXS §3.1). Status is never colour alone — the caller always
 * pairs the tone with an icon glyph and a text label.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 h-6 rounded-sm border px-2 text-xs font-semibold",
  {
    variants: {
      tone: {
        critical: "text-state-critical bg-state-critical/10 border-state-critical/40",
        warning: "text-state-warning bg-state-warning/10 border-state-warning/40",
        ok: "text-state-ok bg-state-ok/10 border-state-ok/40",
        info: "text-state-info bg-state-info/10 border-state-info/40",
        neutral: "text-state-neutral bg-state-neutral/10 border-state-neutral/40",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, className }))} {...props} />;
}

export { badgeVariants };
