"use client";

import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import { DataState, Page } from "@/components/page";
import { StatusChip } from "@/components/status-chip";
import { Button } from "@/components/ui/button";
import { trpc } from "@/trpc/react";

const control = "h-9 w-full rounded-sm border border-rule bg-surface px-2 text-sm";

export default function PersonDetailPage() {
  const personId = String(useParams().id);
  const utils = trpc.useUtils();
  const q = trpc.person.detail.useQuery({ personId });
  const types = trpc.catalogue.certificationTypes.useQuery();
  const addCert = trpc.person.addCertification.useMutation({ onSuccess: () => utils.person.detail.invalidate() });
  const unmask = trpc.person.unmaskNationalId.useMutation();

  const [typeId, setTypeId] = useState("");
  const [reg, setReg] = useState("");
  const [issue, setIssue] = useState("");
  const [expiry, setExpiry] = useState("");
  const [revealed, setRevealed] = useState<string>();
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  async function submitCert(e: React.FormEvent) {
    e.preventDefault();
    await addCert.mutateAsync({ personId, certificationTypeId: typeId, registrationNumber: reg, issueDate: issue, expiryDate: expiry });
    setReg(""); setIssue(""); setExpiry(""); setTypeId("");
  }

  async function upload(certId: string, file: File) {
    const form = new FormData();
    form.append("file", file);
    await fetch(`/api/certifications/${certId}/document`, { method: "POST", body: form });
    utils.person.detail.invalidate();
  }

  async function doUnmask() {
    const reason = window.prompt("Reason for unmasking the national identifier (logged):");
    if (!reason) return;
    const value = await unmask.mutateAsync({ personId, reason }).catch(() => null);
    setRevealed(value ?? "Not permitted or unavailable.");
  }

  return (
    <Page title={q.data?.person.fullName ?? "Person"} breadcrumb="People › Register › Detail">
      <DataState isLoading={q.isLoading} isError={q.isError} isEmpty={!q.data} emptyText="Person not found.">
        {q.data && (
          <>
            <div className="mb-6 rounded-sm border border-rule bg-surface p-4 text-sm">
              <div><span className="text-ink-muted">Employment:</span> {q.data.person.employmentStatus}</div>
              <div><span className="text-ink-muted">Home base:</span> {q.data.person.homeBase ?? "—"}</div>
              <div><span className="text-ink-muted">Languages:</span> {q.data.person.languages.join(", ") || "—"}</div>
              <div className="mt-1">
                <span className="text-ink-muted">National ID:</span>{" "}
                <span className="font-mono">{revealed ?? q.data.person.nationalIdMasked}</span>{" "}
                <button type="button" className="text-xs font-semibold text-state-info hover:underline" onClick={doUnmask}>
                  Unmask (logged)
                </button>
              </div>
            </div>

            <h2 className="mb-2 font-display text-lg text-gs-navy">Certifications</h2>
            <div className="mb-6 overflow-x-auto rounded-sm border border-rule">
              <table className="w-full text-sm">
                <thead className="bg-canvas text-left text-xs uppercase text-ink-muted">
                  <tr><th className="p-2">Type</th><th className="p-2">Reg. no.</th><th className="p-2">Expiry</th><th className="p-2">Status</th><th className="p-2">Document</th></tr>
                </thead>
                <tbody>
                  {q.data.certifications.map((c) => (
                    <tr key={c.id} className={`border-t border-rule ${c.superseded ? "opacity-50" : ""}`}>
                      <td className="p-2">{c.code}{c.superseded && " (superseded)"}</td>
                      <td className="p-2 font-mono text-xs">{c.registrationNumber}</td>
                      <td className="p-2 font-mono text-xs">{c.expiryDate}</td>
                      <td className="p-2"><StatusChip status={c.status} /></td>
                      <td className="p-2 text-xs">
                        {c.documentFilename ? (
                          <a className="text-state-info hover:underline" href={`/api/certifications/${c.id}/document`} target="_blank" rel="noreferrer">View</a>
                        ) : (
                          <input
                            ref={(el) => { fileInputs.current[c.id] = el; }}
                            type="file"
                            accept="application/pdf,image/png,image/jpeg"
                            className="text-xs"
                            onChange={(e) => e.target.files?.[0] && upload(c.id, e.target.files[0])}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 className="mb-2 font-display text-lg text-gs-navy">Add certification</h2>
            <form onSubmit={submitCert} className="flex flex-wrap items-end gap-2 rounded-sm border border-rule bg-surface p-4">
              <select className={control} style={{ width: 160 }} value={typeId} onChange={(e) => setTypeId(e.target.value)} required aria-label="Type">
                <option value="">Type…</option>
                {types.data?.map((t) => <option key={t.id} value={t.id}>{t.code}</option>)}
              </select>
              <input className={control} style={{ width: 150 }} placeholder="Reg. number" value={reg} onChange={(e) => setReg(e.target.value)} required aria-label="Registration number" />
              <input className={control} style={{ width: 150 }} type="date" value={issue} onChange={(e) => setIssue(e.target.value)} required aria-label="Issue date" />
              <input className={control} style={{ width: 150 }} type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} required aria-label="Expiry date" />
              <Button type="submit" size="sm" disabled={addCert.isPending}>Add</Button>
              {addCert.isError && <span className="text-xs font-semibold text-state-critical">{addCert.error.message}</span>}
            </form>
          </>
        )}
      </DataState>
    </Page>
  );
}
