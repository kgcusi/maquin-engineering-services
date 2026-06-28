import type { NotificationChannel } from "@/lib/notification-events";

// Pure dispatcher helpers — no DB, no server deps, so they're unit-tested directly.

export const MAX_ATTEMPTS = 4;
export const DISPATCH_BATCH = 50;

export type RecipientRule =
  | { kind: "ROLE"; role: string }
  | { kind: "USER"; field: string }
  | { kind: "PROJECT"; selector: string }
  | { kind: "NONE" };

/** A recipient_rule may be a union of selectors joined by "+", e.g.
 *  "ROLE:ADMIN+PROJECT:LEAD". Split into individual selectors (the resolver unions
 *  their recipients). A single selector returns a one-element list; null → []. */
export function splitRecipientRules(rule: string | null | undefined): string[] {
  if (!rule) return [];
  return rule
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
}

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

/** Order-insensitive equality of two channel lists (drives the settings "dirty"
 *  check and skips no-op upserts in the update action). */
export function channelsEqual(a: NotificationChannel[], b: NotificationChannel[]): boolean {
  return a.length === b.length && a.every((c) => b.includes(c));
}

const ROLE_RECIPIENT_LABELS: Record<string, string> = {
  ADMIN: "Admins",
  ENGINEER: "Engineers",
  QA_QC_ENGINEER: "QA/QC engineers",
  WEBMASTER: "Webmaster",
};

const USER_FIELD_LABELS: Record<string, string> = {
  assigneeId: "The assignee",
  requesterId: "The requester",
  requestedById: "The requester",
  inspectorId: "The inspector",
  submitterId: "The submitter",
  userId: "The user",
};

/** Human-readable description of a recipient_rule for the settings panel — a
 *  "+"-joined union renders as a "·"-joined phrase, e.g.
 *  "ROLE:ADMIN+PROJECT:LEAD" → "Admins · Project lead". */
export function describeRecipientRule(rule: string | null | undefined): string {
  const tokens = splitRecipientRules(rule);
  if (tokens.length === 0) return "No automatic recipients";
  return tokens
    .map((token) => {
      const parsed = parseRecipientRule(token);
      if (parsed.kind === "ROLE") return ROLE_RECIPIENT_LABELS[parsed.role] ?? parsed.role;
      if (parsed.kind === "USER") return USER_FIELD_LABELS[parsed.field] ?? "A specific user";
      if (parsed.kind === "PROJECT")
        return parsed.selector.includes("LEAD") ? "Project lead" : "Project team";
      return "—";
    })
    .join(" · ");
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

/** Resolve the in-app deep-link (a relative href) for an event from its payload.
 *  Prefix-based on the event key so events gain a target as their module starts
 *  emitting `projectId`. Returns null when there's nothing navigable to point at. */
export function buildNotificationLink(
  eventKey: string,
  payload: Record<string, unknown>,
): string | null {
  const projectId = readString(payload.projectId);
  const entityId = readString(payload.entityId);

  // Project events: entityId IS the project id (no separate projectId in payload).
  if (eventKey.startsWith("project.")) {
    const pid = projectId ?? entityId;
    return pid ? `/projects/${pid}` : null;
  }
  if (!projectId) return null;
  if (eventKey.startsWith("task.") || eventKey.startsWith("phase.")) {
    return `/projects/${projectId}?tab=phases`;
  }
  if (eventKey.startsWith("inspection.")) {
    return `/projects/${projectId}?tab=inspections`;
  }
  if (eventKey.startsWith("dsr.")) {
    return entityId
      ? `/projects/${projectId}/dsr/${entityId}`
      : `/projects/${projectId}?tab=reports`;
  }
  return null;
}
