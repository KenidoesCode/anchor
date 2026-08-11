import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppNav } from "@/components/app-nav";
import { TRPCProvider } from "@/trpc/react";
// Self-hosted fonts (Fontsource) — bundled and served from our own origin, no
// external CDN (PRD §11.2). Inter (body/UI), Inter Tight (display), IBM Plex Mono.
import "@fontsource-variable/inter";
import "@fontsource/inter-tight/400.css";
import "@fontsource/inter-tight/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Greensafe Assure",
  description: "Internal operations and assurance platform — Greensafe International Pte Ltd",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-SG">
      <body>
        <TRPCProvider>
          <header className="flex h-14 items-center gap-3 border-b border-rule bg-surface px-6">
            <span
              aria-hidden="true"
              className="h-3.5 w-3.5 rounded-sm bg-gs-green shadow-[20px_0_0_var(--color-gs-green),40px_0_0_var(--color-gs-green)]"
            />
            <span className="ml-10 font-display font-semibold tracking-wide text-gs-navy">
              GREENSAFE ASSURE
            </span>
          </header>
          <div className="flex min-h-[calc(100vh-56px)]">
            <AppNav />
            <div className="min-w-0 flex-1">{children}</div>
          </div>
        </TRPCProvider>
      </body>
    </html>
  );
}
