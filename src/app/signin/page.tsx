"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const res = await fetch("/api/auth/signin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Sign in failed.");
      return;
    }
    router.push("/people");
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-sm p-6 pt-16">
      <h1 className="mb-1 font-display text-2xl text-gs-navy">Sign in</h1>
      <p className="mb-6 text-sm text-ink-muted">Greensafe Assure — internal platform.</p>
      <form onSubmit={submit} className="rounded-sm border border-rule bg-surface p-5">
        <div className="mb-4">
          <label htmlFor="email" className="mb-1.5 block text-[13px] font-semibold">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            className="h-10 w-full rounded-sm border border-rule bg-surface px-2.5"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="mb-4">
          <label htmlFor="password" className="mb-1.5 block text-[13px] font-semibold">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className="h-10 w-full rounded-sm border border-rule bg-surface px-2.5"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="mb-3 text-[13px] font-semibold text-state-critical">{error}</p>}
        <Button type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </main>
  );
}
