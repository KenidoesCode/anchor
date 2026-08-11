import type { Metadata } from "next";
import type { ReactNode } from "react";
import { TRPCProvider } from "@/trpc/react";
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
          <header className="topbar">
            <span className="mark" aria-hidden="true" />
            <span className="brand">GREENSAFE ASSURE</span>
          </header>
          {children}
        </TRPCProvider>
      </body>
    </html>
  );
}
