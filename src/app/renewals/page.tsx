"use client";

import { Fragment, useState } from "react";
import { DataState, Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { trpc } from "@/trpc/react";

const control = "h-9 rounded-sm border border-rule bg-surface px-2 text-sm";

export default function RenewalsPage() {
  const utils = trpc.useUtils();
  const q = trpc.renewal.listOpen.useQuery();
  const close = trpc.renewal.close.useMutation({ onSuccess: () => utils.renewal.listOpen.invalidate() });
  const [openId, setOpenId] = useState<string>();
  const [reg, setReg] = useState("");
  const [issue, setIssue] = useState("");
  const [expiry, setExpiry] = useState("");
  const [err, setErr] = useState<string>();

  async function submit(taskId: string) {
    setErr(undefined);
    try {
      await close.mutateAsync({ taskId, registrationNumber: reg, issueDate: issue, expiryDate: expiry });
      setOpenId(undefined); setReg(""); setIssue(""); setExpiry("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not close the renewal.");
    }
  }

  return (
    <Page title="Renewals" subtitle="Renewal closes only on a new certificate with a later expiry — evidence, not assertion." breadcrumb="People › Renewals">
      <DataState isLoading={q.isLoading} isError={q.isError} isEmpty={(q.data?.length ?? 0) === 0} emptyText="No open renewal tasks.">
        <div className="overflow-x-auto rounded-sm border border-rule">
          <table className="w-full text-sm">
            <thead className="bg-canvas text-left text-xs uppercase text-ink-muted">
              <tr><th className="p-3">Officer</th><th className="p-3">Certification</th><th className="p-3">Due</th><th className="p-3">Source</th><th className="p-3"></th></tr>
            </thead>
            <tbody>
              {q.data?.map((t) => (
                <Fragment key={t.id}>
                  <tr className="border-t border-rule">
                    <td className="p-3 font-semibold">{t.personName}</td>
                    <td className="p-3">{t.certificationCode} <span className="font-mono text-xs text-ink-muted">{t.registrationNumber}</span></td>
                    <td className="p-3 font-mono text-xs">{t.dueDate}</td>
                    <td className="p-3 text-ink-muted">{t.source}</td>
                    <td className="p-3"><Button size="sm" variant="outline" onClick={() => setOpenId(openId === t.id ? undefined : t.id)}>Close…</Button></td>
                  </tr>
                  {openId === t.id && (
                    <tr className="border-t border-rule bg-canvas">
                      <td colSpan={5} className="p-3">
                        <div className="flex flex-wrap items-end gap-2">
                          <input className={control} placeholder="New reg. number" value={reg} onChange={(e) => setReg(e.target.value)} aria-label="New registration number" />
                          <input className={control} type="date" value={issue} onChange={(e) => setIssue(e.target.value)} aria-label="New issue date" />
                          <input className={control} type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} aria-label="New expiry date" />
                          <Button size="sm" onClick={() => submit(t.id)} disabled={close.isPending}>Upload new certificate & close</Button>
                          {err && <span className="text-xs font-semibold text-state-critical">{err}</span>}
                        </div>
                        <p className="mt-1 text-xs text-ink-muted">The new expiry must be later than the current one.</p>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </DataState>
    </Page>
  );
}
