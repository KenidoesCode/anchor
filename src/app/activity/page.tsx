"use client";

import { DataState, Page } from "@/components/page";
import { trpc } from "@/trpc/react";

export default function ActivityPage() {
  const q = trpc.activity.recent.useQuery();

  return (
    <Page title="Activity log" subtitle="Append-only. Every mutation, override and unmasking (PRD §10.5)." breadcrumb="Admin › Activity log">
      <DataState isLoading={q.isLoading} isError={q.isError} isEmpty={(q.data?.length ?? 0) === 0} emptyText="No activity recorded yet.">
        <div className="overflow-x-auto rounded-sm border border-rule">
          <table className="w-full text-sm">
            <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="p-3 font-semibold">When</th>
                <th className="p-3 font-semibold">Action</th>
                <th className="p-3 font-semibold">Entity</th>
                <th className="p-3 font-semibold">Reason / detail</th>
              </tr>
            </thead>
            <tbody>
              {q.data?.map((e) => (
                <tr key={e.id} className="border-t border-rule">
                  <td className="p-3 font-mono text-xs">{new Date(e.occurredAt).toISOString().slice(0, 19).replace("T", " ")}</td>
                  <td className="p-3 font-semibold">{e.action}</td>
                  <td className="p-3 text-ink-muted">{e.entity}</td>
                  <td className="p-3 text-ink-muted">{e.reason ?? e.detail ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataState>
    </Page>
  );
}
