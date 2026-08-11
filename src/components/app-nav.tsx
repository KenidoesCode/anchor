"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/react";

interface NavItem {
  href: string;
  label: string;
  roles: string[];
}

const ITEMS: NavItem[] = [
  { href: "/overview", label: "Overview", roles: ["director"] },
  { href: "/people", label: "Register", roles: ["director", "deployment_coordinator", "lead_auditor", "auditor", "training_admin", "qehs_consultant", "finance"] },
  { href: "/certifications", label: "Certifications", roles: ["director", "deployment_coordinator", "training_admin"] },
  { href: "/renewals", label: "Renewals", roles: ["director", "deployment_coordinator", "training_admin"] },
  { href: "/deployments", label: "Deployments", roles: ["director", "deployment_coordinator"] },
  { href: "/assign", label: "Assign", roles: ["director", "deployment_coordinator"] },
  { href: "/admin", label: "Admin", roles: ["director"] },
  { href: "/activity", label: "Activity log", roles: ["director"] },
];

export function AppNav() {
  const me = trpc.session.me.useQuery(undefined, { retry: false });
  const pathname = usePathname();
  const router = useRouter();

  if (me.isError) return null; // not signed in — pages guard themselves
  const role = me.data?.role;

  async function signOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/signin");
    router.refresh();
  }

  return (
    <nav className="flex w-56 shrink-0 flex-col gap-1 border-r border-rule bg-surface p-3" aria-label="Primary">
      {ITEMS.filter((i) => !role || i.roles.includes(role)).map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className={cn(
            "rounded-sm px-3 py-2 text-sm font-medium text-ink hover:bg-canvas",
            pathname === i.href && "bg-canvas text-gs-navy",
          )}
        >
          {i.label}
        </Link>
      ))}
      <div className="mt-auto border-t border-rule pt-3 text-xs text-ink-muted">
        {me.data ? (
          <>
            <div className="mb-2">{me.data.fullName}</div>
            <button type="button" onClick={signOut} className="font-semibold text-state-info hover:underline">
              Sign out
            </button>
          </>
        ) : null}
      </div>
    </nav>
  );
}
