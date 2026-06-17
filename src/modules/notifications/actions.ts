"use server";

import { and, eq, ne } from "drizzle-orm";

import { notifications } from "@/db/schema/notifications";
import { action, actionNoTx } from "@/lib/rbac";

import { sendTest } from "./service";
import { emptySchema, markNotificationReadSchema } from "./schema";

// Mark one of the actor's own in-app notifications read. Ownership is enforced in
// the WHERE clause (recipient_id = actor.id) — a user can never touch another's row.
export const markNotificationReadAction = action(
  "notification.view",
  markNotificationReadSchema,
  async (input, { user: actor, tx }) => {
    await tx
      .update(notifications)
      .set({ status: "READ", readAt: new Date() })
      .where(
        and(
          eq(notifications.id, input.id),
          eq(notifications.recipientId, actor.id),
          eq(notifications.channel, "IN_APP"),
        ),
      );
    return { ok: true };
  },
);

export const markAllNotificationsReadAction = action(
  "notification.view",
  emptySchema,
  async (_input, { user: actor, tx }) => {
    await tx
      .update(notifications)
      .set({ status: "READ", readAt: new Date() })
      .where(
        and(
          eq(notifications.recipientId, actor.id),
          eq(notifications.channel, "IN_APP"),
          ne(notifications.status, "READ"),
        ),
      );
    return { ok: true };
  },
);

// WEBMASTER-only (settings.manage), reusing the secret-key panel's guard. Runs the
// full pipeline inline to the actor — a real end-to-end deliverability check.
export const sendTestNotificationAction = actionNoTx(
  "settings.manage",
  emptySchema,
  async (_input, { user: actor, db }) => {
    return sendTest(db, actor);
  },
);
