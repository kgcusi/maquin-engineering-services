import { and, count, desc, eq, ne } from "drizzle-orm";

import { db } from "@/db/client";
import { notifications } from "@/db/schema/notifications";
import { notificationSettings } from "@/db/schema/notification-settings";
import {
  NOTIFICATION_EVENTS,
  NOTIFICATION_EVENT_KEYS,
  type NotificationChannel,
  type NotificationEventKey,
} from "@/lib/notification-events";

import { describeRecipientRule, parseChannels } from "./domain";

// User-scoped, DYNAMIC reads (no `use cache`) — the bell streams inside <Suspense>
// in the topbar. In-app notifications only; email rows never surface here.

export type BellNotification = {
  id: string;
  eventKey: string;
  subject: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  link: string | null;
  createdAt: Date;
  read: boolean;
};

export async function getUnreadCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientId, userId),
        eq(notifications.channel, "IN_APP"),
        ne(notifications.status, "READ"),
      ),
    );
  return row?.value ?? 0;
}

export async function listRecentNotifications(
  userId: string,
  limit = 10,
): Promise<BellNotification[]> {
  const rows = await db
    .select({
      id: notifications.id,
      eventKey: notifications.eventKey,
      subject: notifications.subject,
      body: notifications.body,
      status: notifications.status,
      entityType: notifications.entityType,
      entityId: notifications.entityId,
      link: notifications.link,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(and(eq(notifications.recipientId, userId), eq(notifications.channel, "IN_APP")))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    eventKey: r.eventKey,
    subject: r.subject,
    body: r.body,
    entityType: r.entityType,
    entityId: r.entityId,
    link: r.link,
    createdAt: r.createdAt,
    read: r.status === "READ",
  }));
}

export type NotificationSettingRow = {
  eventKey: NotificationEventKey;
  label: string;
  enabled: boolean;
  channels: NotificationChannel[];
  recipientLabel: string;
};

// The full event catalog merged with the saved notification_settings rows
// (WEBMASTER settings panel). An event with no row yet (never seeded) surfaces with
// its catalog defaults and `enabled: false`, so the panel always lists every event
// — and because the update action UPSERTS, turning one on writes its row. That makes
// the panel its own seeding path: a fresh DB needs no `db:seed` to enable an event.
export async function listNotificationSettings(): Promise<NotificationSettingRow[]> {
  const rows = await db.select().from(notificationSettings);
  const byKey = new Map(rows.map((r) => [r.eventKey, r]));

  return NOTIFICATION_EVENT_KEYS.map((key) => {
    const def = NOTIFICATION_EVENTS[key];
    const row = byKey.get(key);
    const recipientRule = row?.recipientRule ?? def.defaultRecipientRule;
    return {
      eventKey: key,
      label: def.label,
      enabled: row?.enabled ?? false,
      channels: row ? parseChannels(row.channels) : [...def.defaultChannels],
      recipientLabel: describeRecipientRule(recipientRule),
    };
  });
}
