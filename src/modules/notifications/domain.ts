import type { NotificationChannel } from "@/lib/notification-events";

// Pure dispatcher helpers — no DB, no server deps, so they're unit-tested directly.

export const MAX_ATTEMPTS = 4;
export const DISPATCH_BATCH = 50;

export type RecipientRule =
  | { kind: "ROLE"; role: string }
  | { kind: "USER"; field: string }
  | { kind: "PROJECT"; selector: string }
  | { kind: "NONE" };

/** Parse a notification_settings.recipient_rule selector (e.g. "ROLE:ADMIN"). */
export function parseRecipientRule(rule: string | null | undefined): RecipientRule {
  if (!rule) return { kind: "NONE" };
  const idx = rule.indexOf(":");
  if (idx === -1) return { kind: "NONE" };
  const prefix = rule.slice(0, idx).trim().toUpperCase();
  const value = rule.slice(idx + 1).trim();
  if (!value) return { kind: "NONE" };
  switch (prefix) {
    case "ROLE":
      return { kind: "ROLE", role: value.toUpperCase() };
    case "USER":
      return { kind: "USER", field: value };
    case "PROJECT":
      return { kind: "PROJECT", selector: value.toUpperCase() };
    default:
      return { kind: "NONE" };
  }
}

/** Deterministic de-dup key: one event can't fan out twice to the same recipient
 *  on the same channel. `scopeId` is the entity id (or the outbox row id when the
 *  event has no entity), which keeps re-drains of the same emission idempotent. */
export function buildIdempotencyKey(parts: {
  eventKey: string;
  scopeId: string;
  recipientId: string;
  channel: NotificationChannel;
}): string {
  return [parts.eventKey, parts.scopeId, parts.recipientId, parts.channel].join("::");
}

const BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000];

/** Delay (ms) before the next attempt, given how many attempts have already failed.
 *  attempts=1 → 1m, 2 → 5m, 3 → 30m, 4 → 2h (then FAILED at MAX_ATTEMPTS). */
export function backoffMs(attempts: number): number {
  if (attempts < 1) return 0;
  return BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length) - 1];
}

const VALID_CHANNELS: readonly NotificationChannel[] = ["EMAIL", "IN_APP"];

/** Normalize the jsonb `channels` array into a clean, de-duped channel list. */
export function parseChannels(value: unknown): NotificationChannel[] {
  if (!Array.isArray(value)) return [];
  const out: NotificationChannel[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const up = entry.toUpperCase() as NotificationChannel;
    if (VALID_CHANNELS.includes(up) && !out.includes(up)) out.push(up);
  }
  return out;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Derive the display copy + deep-link target for an event from its payload. */
export function buildNotificationContent(
  eventLabel: string,
  payload: Record<string, unknown>,
): { subject: string; body: string; entityType: string | null; entityId: string | null } {
  const message = readString(payload.message) ?? readString(payload.summary) ?? `${eventLabel}.`;
  return {
    subject: eventLabel,
    body: message,
    entityType: readString(payload.entityType),
    entityId: readString(payload.entityId),
  };
}
