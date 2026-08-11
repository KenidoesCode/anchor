"use client";

import Link from "next/link";
import { DataState, Page } from "@/components/page";
import { trpc } from "@/trpc/react";

function Tile({ n, label, tone, href }: { n: number; label: string; tone: string; href: string }) {
  return (
    <Link href={href} className="block rounded-sm border border-rule bg-surface p-5 hover:bg-canvas">
      <div className={`font-mono text-[40px] leading-none ${tone}`}>{n}</div>
      <div className="mt-2 text-sm text-ink-muted">{label}</div>
    </Link>
  );
}

export default function OverviewPage() {
  const q = trpc.overview.tiles.useQuery();

  return (
    <Page title="Exposure overview" subtitle="Is anything exposed right now?" breadcrumb="Overview">
      <DataState isLoading={q.isLoading} isError={q.isError} isEmpty={false} emptyText="">
        {q.data && (
          <>
            {q.data.lapsedAmongDeployed > 0 && (
              <div className="mb-5 rounded-sm border border-l-4 border-rule border-l-state-critical bg-surface p-4 font-semibold text-state-critical">
                ✕ {q.data.lapsedAmongDeployed} officer(s) are deployed under a lapsed certification.
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <Tile n={q.data.lapsedAmongDeployed} label="lapsed, deployed" tone="text-state-critical" href="/deployments" />
              <Tile n={q.data.expiringWithin90} label="expiring ≤90 days" tone="text-state-warning" href="/certifications" />
              <Tile n={q.data.openOverrides} label="overrides open" tone="text-state-info" href="/activity" />
            </div>
            {q.data.lapsedAmongDeployed === 0 && q.data.openOverrides === 0 && (
              <p className="mt-6 text-sm text-ink-muted">Nothing exposed. That is the product working.</p>
            )}
            <p className="mt-8 text-xs text-ink-muted">
              Submissions, claims, audits and corrective actions appear here from Phase 2/3 (ADR-0006).
            </p>
          </>
        )}
      </DataState>
    </Page>
  );
}
