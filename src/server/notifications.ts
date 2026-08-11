import { eq } from "drizzle-orm";
import type { Db } from "@/db/pg";
import * as s from "@/db/schema";

/**
 * Notification dispatch. Slice 5 ships a CONSOLE/LOG adapter only — no SES,
 * Twilio or WhatsApp is wired, no credentials exist, and no real address ever
 * receives anything from this build (as instructed). The outbox (`notification`)
 * is the durable record; dispatch marks rows sent. Wiring a real channel later
 * is a new adapter behind this same interface.
 */
export interface NotificationAdapter {
  send(n: {
    channel: string;
    recipientId: string | null;
    recipientRole: string | null;
    subject: string;
    body: string;
  }): Promise<void>;
}

export const consoleAdapter: NotificationAdapter = {
  async send(n) {
    // eslint-disable-next-line no-console
    console.log(
      `[notify:${n.channel}] → ${n.recipientRole ?? "person"}${n.recipientId ? ` ${n.recipientId}` : ""}: ${n.subject}`,
    );
  },
};

/** In-app: no external send — the row is read by the bell (routers/notifications). */
export const inAppAdapter: NotificationAdapter = {
  async send() {
    /* no-op: visibility is the notification row itself */
  },
};

/** Stubs that throw clearly if selected without credentials. Never wired to real providers. */
export const emailStubAdapter: NotificationAdapter = {
  async send() {
    throw new Error("Email channel selected but no provider is configured (SES not wired). Demo build.");
  },
};
export const smsStubAdapter: NotificationAdapter = {
  async send() {
    throw new Error("SMS channel selected but no provider is configured (Twilio not wired). Demo build.");
  },
};

/**
 * Resolve the adapter for a channel. Default is console (demo-safe: nothing is
 * sent, nothing fails). Email/SMS route to their stubs ONLY when explicitly
 * config-selected (GS_NOTIFY_EMAIL=stub / GS_NOTIFY_SMS=stub), which then throw.
 */
export function adapterForChannel(channel: string): NotificationAdapter {
  if (channel === "in_app") return inAppAdapter;
  if (channel === "email" && process.env.GS_NOTIFY_EMAIL === "stub") return emailStubAdapter;
  if (channel === "sms" && process.env.GS_NOTIFY_SMS === "stub") return smsStubAdapter;
  return consoleAdapter;
}

/** Dispatch all pending notifications through the given adapter (console by default). */
export async function dispatchPending(
  db: Db,
  adapter?: NotificationAdapter,
  now = new Date(),
): Promise<number> {
  const pending = await db
    .select()
    .from(s.notification)
    .where(eq(s.notification.status, "pending"));
  for (const n of pending) {
    try {
      // Route by the row's channel unless an explicit adapter is injected (tests).
      await (adapter ?? adapterForChannel(n.channel)).send({
        channel: n.channel,
        recipientId: n.recipientId,
        recipientRole: n.recipientRole,
        subject: n.subject,
        body: n.body,
      });
      await db
        .update(s.notification)
        .set({ status: "sent", sentAt: now })
        .where(eq(s.notification.id, n.id));
    } catch {
      // Nothing fails silently: leave the row for retry and mark it failed.
      await db.update(s.notification).set({ status: "failed" }).where(eq(s.notification.id, n.id));
    }
  }
  return pending.length;
}
