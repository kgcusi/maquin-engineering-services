import { z } from "zod";

import { NOTIFICATION_EVENT_KEYS, type NotificationEventKey } from "@/lib/notification-events";

// Pure Zod — shared by the guarded actions and unit tests (no server imports).

export const markNotificationReadSchema = z.object({
  id: z.string().uuid(),
});
export type MarkNotificationReadInput = z.infer<typeof markNotificationReadSchema>;

// No input — the actor is taken from the session in the action guard.
export const emptySchema = z.object({});

// WEBMASTER notification settings panel: a row per event with its enabled flag and
// chosen channels. recipient_rule / mode aren't user-editable (catalog-owned), so
// they're not in the payload — the action keeps the stored/default values. An
// enabled event must keep at least one channel, or nothing would ever send.
const NOTIFICATION_CHANNELS = ["EMAIL", "IN_APP"] as const;

export const updateNotificationSettingsSchema = z.object({
  events: z
    .array(
      z
        .object({
          eventKey: z.enum(
            NOTIFICATION_EVENT_KEYS as [NotificationEventKey, ...NotificationEventKey[]],
          ),
          enabled: z.boolean(),
          channels: z.array(z.enum(NOTIFICATION_CHANNELS)),
        })
        .refine((e) => !e.enabled || e.channels.length > 0, {
          message: "Pick at least one channel for an enabled event.",
          path: ["channels"],
        }),
    )
    .min(1),
});
export type UpdateNotificationSettingsInput = z.infer<typeof updateNotificationSettingsSchema>;
