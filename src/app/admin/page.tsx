"use client";

import { DataState, Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { trpc } from "@/trpc/react";

const control = "h-8 rounded-sm border border-rule bg-surface px-2 text-sm";

function SettingsCard() {
  const utils = trpc.useUtils();
  const q = trpc.admin.listSettings.useQuery();
  const update = trpc.admin.updateSetting.useMutation({ onSuccess: () => utils.admin.listSettings.invalidate() });

  return (
    <section className="mb-8">
      <h2 className="mb-2 font-display text-lg text-gs-navy">Application settings</h2>
      <p className="mb-3 text-sm text-ink-muted">Rules are data. Change a value here — no deploy.</p>
      <DataState isLoading={q.isLoading} isError={q.isError} isEmpty={false} emptyText="">
        <div className="overflow-x-auto rounded-sm border border-rule">
          <table className="w-full text-sm">
            <thead className="bg-canvas text-left text-xs uppercase text-ink-muted"><tr><th className="p-2">Key</th><th className="p-2">Value</th><th className="p-2">Description</th></tr></thead>
            <tbody>
              {q.data?.map((row) => (
                <tr key={row.key} className="border-t border-rule">
                  <td className="p-2 font-mono text-xs">{row.key}</td>
                  <td className="p-2">
                    <input
                      className={control}
                      defaultValue={JSON.stringify(row.value)}
                      onBlur={(e) => {
                        try {
                          update.mutate({ key: row.key, value: JSON.parse(e.target.value) });
                        } catch {
                          /* ignore invalid JSON */
                        }
                      }}
                      aria-label={`Value for ${row.key}`}
                    />
                  </td>
                  <td className="p-2 text-xs text-ink-muted">{row.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataState>
    </section>
  );
}

function StagesCard() {
  const utils = trpc.useUtils();
  const q = trpc.admin.listEscalationStages.useQuery();
  const update = trpc.admin.updateEscalationStage.useMutation({ onSuccess: () => utils.admin.listEscalationStages.invalidate() });

  return (
    <section>
      <h2 className="mb-2 font-display text-lg text-gs-navy">Escalation stages</h2>
      <p className="mb-3 text-sm text-ink-muted">The cascade reads these. Change a threshold or recipient here.</p>
      <DataState isLoading={q.isLoading} isError={q.isError} isEmpty={false} emptyText="">
        <div className="overflow-x-auto rounded-sm border border-rule">
          <table className="w-full text-sm">
            <thead className="bg-canvas text-left text-xs uppercase text-ink-muted"><tr><th className="p-2">Stage</th><th className="p-2">Days before</th><th className="p-2">Notifies</th><th className="p-2">Channel</th></tr></thead>
            <tbody>
              {q.data?.map((st) => (
                <tr key={st.id} className="border-t border-rule">
                  <td className="p-2 font-mono text-xs">{st.stageKey}</td>
                  <td className="p-2">
                    <input className={control} style={{ width: 70 }} type="number" defaultValue={st.daysBefore}
                      onBlur={(e) => update.mutate({ stageKey: st.stageKey, daysBefore: Number(e.target.value) })} aria-label={`Days for ${st.stageKey}`} />
                  </td>
                  <td className="p-2">
                    <select className={control} defaultValue={st.notifyTarget}
                      onChange={(e) => update.mutate({ stageKey: st.stageKey, notifyTarget: e.target.value as "holder" | "line_manager" | "account_owner" | "director" })} aria-label={`Recipient for ${st.stageKey}`}>
                      {["holder", "line_manager", "account_owner", "director"].map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td className="p-2">
                    <select className={control} defaultValue={st.channel}
                      onChange={(e) => update.mutate({ stageKey: st.stageKey, channel: e.target.value as "in_app" | "email" | "sms" })} aria-label={`Channel for ${st.stageKey}`}>
                      {["in_app", "email", "sms"].map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataState>
    </section>
  );
}

export default function AdminPage() {
  return (
    <Page title="Administration" subtitle="Configuration, not code — every rule below is editable data (ADR-0017)." breadcrumb="Admin">
      <SettingsCard />
      <StagesCard />
    </Page>
  );
}
