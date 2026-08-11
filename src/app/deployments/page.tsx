"use client";

import { DataState, Page } from "@/components/page";
import { StatusChip } from "@/components/status-chip";
import { trpc } from "@/trpc/react";

export default function DeploymentsPage() {
  const q = trpc.register.deployments.useQuery();

  return (
    <Page title="Deployments" subtitle="Who is posted where, right now — with live validity." breadcrumb="People › Deployments">
      <DataState isLoading={q.isLoading} isError={q.isError} isEmpty={(q.data?.length ?? 0) === 0} emptyText="No active deployments.">
        <div className="overflow-x-auto rounded-sm border border-rule">
          <table className="w-full text-sm">
            <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="p-3 font-semibold">Officer</th>
                <th className="p-3 font-semibold">Client · site</th>
                <th className="p-3 font-semibold">Role</th>
                <th className="p-3 font-semibold">Period</th>
                <th className="p-3 font-semibold">Validity</th>
                <th className="p-3 font-semibold">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {q.data?.map((d) => (
                <tr key={d.deploymentId} className="border-t border-rule">
                  <td className="p-3 font-semibold">{d.personName}</td>
                  <td className="p-3 text-ink-muted">{d.orgName} · {d.siteName}</td>
                  <td className="p-3">{d.roleCode}</td>
                  <td className="p-3 font-mono text-xs">{d.startDate} → {d.endDate ?? "open"}</td>
                  <td className="p-3"><StatusChip status={d.validity} /></td>
                  <td className="p-3">
                    {d.outcome === "overridden" ? (
                      <span className="font-semibold text-state-critical">Overridden</span>
                    ) : (
                      <span className="text-ink-muted">{d.outcome}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataState>
    </Page>
  );
}
