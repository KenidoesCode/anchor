"use client";

import { useState } from "react";
import { trpc } from "@/trpc/react";

/** Top-bar notification bell: unread count + dropdown, each linking to its record. */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();
  const q = trpc.notifications.unread.useQuery(undefined, { retry: false });
  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => utils.notifications.unread.invalidate(),
  });

  if (q.isError) return null; // not signed in
  const items = q.data ?? [];

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Notifications: ${items.length} unread`}
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-sm px-2 py-1 text-lg hover:bg-canvas"
      >
        <span aria-hidden="true">🔔</span>
        {items.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-state-critical px-1 text-[10px] font-bold leading-4 text-white">
            {items.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-80 rounded-sm border border-rule bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-rule p-2 text-xs">
            <span className="font-semibold">Notifications</span>
            {items.length > 0 && (
              <button type="button" className="text-state-info hover:underline" onClick={() => markRead.mutate({})}>
                Mark all read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="p-3 text-xs text-ink-muted">Nothing unread.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id} className="border-b border-rule p-2.5 text-xs last:border-b-0">
                  <div className="font-medium">{n.subject}</div>
                  <button
                    type="button"
                    className="mt-1 text-state-info hover:underline"
                    onClick={() => markRead.mutate({ id: n.id })}
                  >
                    Mark read
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
