"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // In production this would go to Sentry; never include personal data.
    // eslint-disable-next-line no-console
    console.error("route error", error.digest);
  }, [error]);

  return (
    <main className="mx-auto max-w-md p-6 pt-20 text-center">
      <h1 className="mb-2 font-display text-2xl text-gs-navy">Something went wrong</h1>
      <p className="mb-6 text-ink-muted">
        This screen could not be shown. The error has been recorded. You can try again.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
