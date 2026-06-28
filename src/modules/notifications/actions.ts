"use server";

import { and, eq, ne } from "drizzle-orm";

import { notifications } from "@/db/schema/notifications";
import { notificationSettings } from "@/db/schema/notification-settings";
import { audit } from "@/lib/audit";
import { NOTIFICATION_EVENTS } from "@/lib/notification-events";
import { action, actionNoTx } from "@/lib/rbac";

import { channelsEqual, parseChannels } from "./domain";
import { deliverQueued, dispatchOutbox, sendTest } from "./service";
import {
  emptySchema,
  markNotificationReadSchema,
  updateNotificationSettingsSchema,
} from "./schema";

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

// Turn events on/off and choose channels. UPSERTS per event (so enabling an unseeded
// event creates its row), skipping rows whose effective state is unchanged — a first
// save only writes the events the firm actually touched. recipient_rule/mode are
// catalog-owned: an existing row keeps its value, a new row takes the catalog default.
export const updateNotificationSettingsAction = actionNoTx(
  "notification.settings.manage",
  updateNotificationSettingsSchema,
  async (input, { user: actor, db }) => {
    const changed = await db.transaction(async (tx) => {
      const existing = await tx.select().from(notificationSettings);
      const byKey = new Map(existing.map((r) => [r.eventKey, r]));
      let touched = 0;

      for (const e of input.events) {
        const def = NOTIFICATION_EVENTS[e.eventKey];
        const prev = byKey.get(e.eventKey);
        const prevEnabled = prev?.enabled ?? false;
        const prevChannels = prev ? parseChannels(prev.channels) : [...def.defaultChannels];
        if (prevEnabled === e.enabled && channelsEqual(prevChannels, e.channels)) continue;

        await tx
          .insert(notificationSettings)
          .values({
            eventKey: e.eventKey,
            enabled: e.enabled,
            channels: e.channels,
            recipientRule: prev?.recipientRule ?? def.defaultRecipientRule,
            mode: prev?.mode ?? def.defaultMode,
          })
          .onConflictDoUpdate({
            target: notificationSettings.eventKey,
            set: { enabled: e.enabled, channels: e.channels, updatedAt: new Date() },
          });
        touched += 1;
      }

      if (touched > 0) {
        await audit(tx, {
          actorId: actor.id,
          action: "notification.settings.updated",
          entityType: "notification_settings",
          entityId: null,
          summary: `Updated notification settings (${touched} ${
            touched === 1 ? "event" : "events"
          })`,
        });
      }
      return touched;
    });

    return { changed };
  },
);

// Manual outbox drain — the in-app twin of the Vercel cron (which is Bearer-gated and
// never fires on localhost). Dispatches queued events into notification rows, then
// sends any queued emails. Lets the webmaster flush the queue on demand from the UI.
export const drainNotificationsAction = actionNoTx(
  "notification.settings.manage",
  emptySchema,
  async (_input, { db }) => {
    const dispatched = await dispatchOutbox(db);
    const delivered = await deliverQueued(db);
    return { dispatched, delivered };
  },
);
