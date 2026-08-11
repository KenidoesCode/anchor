"use client";

import Link from "next/link";
import { DataState, Page } from "@/components/page";
import { StatusChip } from "@/components/status-chip";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/csv";
import { trpc } from "@/trpc/react";

export default function PeoplePage() {
  const q = trpc.register.people.useQuery();

  return (
    <Page title="Register" subtitle="Personnel by risk — worst status first, not alphabetical." breadcrumb="People › Register">
      <div className="mb-3 flex gap-2">
        <Link href="/people/new"><Button size="sm">Onboard a person</Button></Link>
        <Button size="sm" variant="outline" onClick={() => q.data && downloadCsv("register.csv", q.data.map((p) => ({ name: p.fullName, certifications: p.certificationsHeld, worst_status: p.worstStatus ?? "", next_expiry: p.nextExpiry ?? "", deployed_at: p.deployedAt })))}>
          Export CSV
        </Button>
      </div>
      <DataState isLoading={q.isLoading} isError={q.isError} isEmpty={(q.data?.length ?? 0) === 0} emptyText="No one matches these filters.">
        <div className="overflow-x-auto rounded-sm border border-rule">
          <table className="w-full text-sm">
            <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="p-3 font-semibold">Name</th>
                <th className="p-3 font-semibold">Certifications held</th>
                <th className="p-3 font-semibold">Worst status</th>
                <th className="p-3 font-semibold">Next expiry</th>
                <th className="p-3 font-semibold">Deployed at</th>
              </tr>
            </thead>
            <tbody>
              {q.data?.map((p) => (
                <tr key={p.personId} className="border-t border-rule">
                  <td className="p-3 font-semibold">
                    <Link href={`/people/${p.personId}`} className="text-gs-navy hover:underline">{p.fullName}</Link>
                  </td>
                  <td className="p-3 text-ink-muted">{p.certificationsHeld.join(", ") || "—"}</td>
                  <td className="p-3"><StatusChip status={p.worstStatus} /></td>
                  <td className="p-3 font-mono">{p.nextExpiry ?? "—"}</td>
                  <td className="p-3 text-ink-muted">{p.deployedAt.join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataState>
    </Page>
  );
}
