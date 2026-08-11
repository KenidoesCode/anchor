"use client";

import { DataState, Page } from "@/components/page";
import { trpc } from "@/trpc/react";

type Card = {
  certId: string;
  personName: string;
  code: string;
  registrationNumber: string;
  expiryDate: string;
  daysRemaining: number;
  deployedAt: string | null;
};

const COLUMNS: { title: string; test: (d: number) => boolean }[] = [
  { title: "Lapsed", test: (d) => d < 0 },
  { title: "≤7 days", test: (d) => d >= 0 && d <= 7 },
  { title: "≤30 days", test: (d) => d > 7 && d <= 30 },
  { title: "≤90 days", test: (d) => d > 30 && d <= 90 },
  { title: "Valid", test: (d) => d > 90 },
];

export default function CertificationsPage() {
  const q = trpc.register.certifications.useQuery();
  const cards = (q.data ?? []) as Card[];

  return (
    <Page title="Certifications" subtitle="Expiry board — the population that matters most." breadcrumb="People › Certifications">
      <DataState isLoading={q.isLoading} isError={q.isError} isEmpty={cards.length === 0} emptyText="No certifications on file.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          {COLUMNS.map((col) => {
            const items = cards.filter((c) => col.test(c.daysRemaining));
            return (
              <div key={col.title}>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {col.title} · {items.length}
                </h2>
                <div className="flex flex-col gap-2">
                  {items.map((c) => (
                    <div key={c.certId} className="rounded-sm border border-rule bg-surface p-3">
                      <div className="font-semibold">{c.personName}</div>
                      <div className="text-xs text-ink-muted">{c.code}</div>
                      <div className="mt-1 font-mono text-xs">{c.registrationNumber}</div>
                      <div className="font-mono text-xs">{c.expiryDate}</div>
                      {c.deployedAt && (
                        <div className="mt-1 inline-block rounded-sm bg-canvas px-1.5 py-0.5 text-xs">{c.deployedAt}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </DataState>
    </Page>
  );
}
