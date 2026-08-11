import type { ReactNode } from "react";

/** Standard page frame — title, optional subtitle, content. */
export function Page({ title, subtitle, breadcrumb, children }: { title: string; subtitle?: string; breadcrumb?: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-[1440px] p-6">
      {breadcrumb && <div className="mb-4 text-[13px] text-ink-muted">{breadcrumb}</div>}
      <h1 className="mb-1 font-display text-2xl text-gs-navy">{title}</h1>
      {subtitle && <p className="mb-5 text-ink-muted">{subtitle}</p>}
      <div className={subtitle ? "" : "mt-4"}>{children}</div>
    </main>
  );
}

/** Uniform loading / error / empty states (UXS §7). */
export function DataState({
  isLoading,
  isError,
  isEmpty,
  emptyText,
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  emptyText: string;
  children: ReactNode;
}) {
  if (isLoading) return <p className="text-sm text-ink-muted">Loading…</p>;
  if (isError)
    return (
      <p className="text-sm font-semibold text-state-critical">
        Could not load this data. You may not have access, or your session may have expired.
      </p>
    );
  if (isEmpty) return <p className="text-sm text-ink-muted">{emptyText}</p>;
  return <>{children}</>;
}
