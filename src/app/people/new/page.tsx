"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { trpc } from "@/trpc/react";

const control = "h-10 w-full rounded-sm border border-rule bg-surface px-2.5";
const label = "mb-1.5 block text-[13px] font-semibold";

export default function NewPersonPage() {
  const router = useRouter();
  const create = trpc.person.create.useMutation();
  const [fullName, setFullName] = useState("");
  const [homeBase, setHomeBase] = useState("");
  const [languages, setLanguages] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [status, setStatus] = useState<"employed" | "associate" | "inactive">("employed");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const id = await create.mutateAsync({
      fullName,
      employmentStatus: status,
      homeBase: homeBase || null,
      languages: languages ? languages.split(",").map((l) => l.trim()).filter(Boolean) : [],
      nationalId: nationalId || null,
    });
    router.push(`/people/${id}`);
  }

  return (
    <Page title="Onboard a person" subtitle="Personal details. The national identifier is encrypted and masked." breadcrumb="People › Register › New">
      <form onSubmit={submit} className="max-w-xl rounded-sm border border-rule bg-surface p-5">
        <div className="mb-4">
          <label htmlFor="name" className={label}>Full name</label>
          <input id="name" className={control} value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div className="mb-4">
          <label htmlFor="status" className={label}>Employment status</label>
          <select id="status" className={control} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="employed">Employed</option>
            <option value="associate">Associate</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="mb-4">
          <label htmlFor="home" className={label}>Home base</label>
          <input id="home" className={control} value={homeBase} onChange={(e) => setHomeBase(e.target.value)} />
        </div>
        <div className="mb-4">
          <label htmlFor="langs" className={label}>Languages (comma-separated)</label>
          <input id="langs" className={control} value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder="English, Mandarin, Tamil" />
        </div>
        <div className="mb-4">
          <label htmlFor="nric" className={label}>National ID (NRIC/FIN)</label>
          <input id="nric" className={control} value={nationalId} onChange={(e) => setNationalId(e.target.value)} autoComplete="off" />
          <p className="mt-1 text-xs text-ink-muted">Encrypted at rest; masked everywhere. Do not enter a real identifier — this is a demo.</p>
        </div>
        {create.isError && <p className="mb-3 text-[13px] font-semibold text-state-critical">Could not save. Check your access and try again.</p>}
        <Button type="submit" disabled={create.isPending}>{create.isPending ? "Saving…" : "Create person"}</Button>
      </form>
    </Page>
  );
}
