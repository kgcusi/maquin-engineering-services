import { and, count, desc, eq, ne } from "drizzle-orm";

import { db } from "@/db/client";
import { notifications } from "@/db/schema/notifications";

// User-scoped, DYNAMIC reads (no `use cache`) — the bell streams inside <Suspense>
// in the topbar. In-app notifications only; email rows never surface here.

export type BellNotification = {
  id: string;
  eventKey: string;
  subject: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
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
    createdAt: r.createdAt,
    read: r.status === "READ",
  }));
}
