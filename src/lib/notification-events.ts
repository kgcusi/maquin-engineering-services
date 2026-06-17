// The notification event catalog (docs/08 §3) — pure data, NO server imports, so
// it's shared by the seed, the dispatcher, and unit tests. The pipeline is
// data-driven: adding an event means adding an entry here + a notification_settings
// row, never touching the dispatcher.
//
// `recipientRule` is the selector the dispatcher resolves at send time:
//   ROLE:ADMIN              → every active admin
//   USER:<payloadField>     → the user id found at event.payload[field]
//   PROJECT:LEAD_ENGINEER   → the project's lead engineer (resolvable from Stage 2)
// Rules the resolver can't satisfy yet (PROJECT:*) simply produce no recipients.

export type NotificationChannel = "EMAIL" | "IN_APP";
export type NotificationMode = "IMMEDIATE" | "DIGEST";

export type NotificationEventDef = {
  /** Human label for the in-app item, email subject, and audit summary. */
  label: string;
  /** Who receives it by default (resolved at dispatch). Null = no auto-recipients. */
  defaultRecipientRule: string | null;
  /** Channels to use when the firm enables this event. */
  defaultChannels: NotificationChannel[];
  defaultMode: NotificationMode;
};

export const NOTIFICATION_EVENTS = {
  "material_request.submitted": {
    label: "Material request submitted",
    defaultRecipientRule: "ROLE:ADMIN",
    defaultChannels: ["EMAIL", "IN_APP"],
    defaultMode: "IMMEDIATE",
  },
  "material_request.approved": {
    label: "Material request approved",
    defaultRecipientRule: "USER:requesterId",
    defaultChannels: ["EMAIL", "IN_APP"],
    defaultMode: "IMMEDIATE",
  },
  "material_request.rejected": {
    label: "Material request rejected",
    defaultRecipientRule: "USER:requesterId",
    defaultChannels: ["EMAIL", "IN_APP"],
    defaultMode: "IMMEDIATE",
  },
  "material_request.released": {
    label: "Materials released",
    defaultRecipientRule: "USER:requesterId",
    defaultChannels: ["EMAIL", "IN_APP"],
    defaultMode: "IMMEDIATE",
  },
  "receiving.discrepancy": {
    label: "Receiving discrepancy reported",
    defaultRecipientRule: "ROLE:ADMIN",
    defaultChannels: ["EMAIL", "IN_APP"],
    defaultMode: "IMMEDIATE",
  },
  "expense.submitted": {
    label: "Expense submitted",
    defaultRecipientRule: "ROLE:ADMIN",
    defaultChannels: ["EMAIL", "IN_APP"],
    defaultMode: "IMMEDIATE",
  },
  "expense.approved": {
    label: "Expense approved",
    defaultRecipientRule: "USER:submitterId",
    defaultChannels: ["EMAIL", "IN_APP"],
    defaultMode: "IMMEDIATE",
  },
  "expense.rejected": {
    label: "Expense rejected",
    defaultRecipientRule: "USER:submitterId",
    defaultChannels: ["EMAIL", "IN_APP"],
    defaultMode: "IMMEDIATE",
  },
  "budget.exceeded": {
    label: "Budget threshold exceeded",
    defaultRecipientRule: "ROLE:ADMIN",
    defaultChannels: ["EMAIL", "IN_APP"],
    defaultMode: "IMMEDIATE",
  },
  "approval.pending": {
    label: "Approval pending",
    defaultRecipientRule: "ROLE:ADMIN",
    defaultChannels: ["EMAIL", "IN_APP"],
    defaultMode: "IMMEDIATE",
  },
  "task.delayed": {
    label: "Task delayed",
    defaultRecipientRule: "ROLE:ADMIN",
    defaultChannels: ["EMAIL", "IN_APP"],
    defaultMode: "DIGEST",
  },
  "phase.critical_update": {
    label: "Phase flagged critical",
    defaultRecipientRule: "PROJECT:LEAD_ENGINEER",
    defaultChannels: ["EMAIL", "IN_APP"],
    defaultMode: "IMMEDIATE",
  },
  "dsr.submitted": {
    label: "Daily site report submitted",
    defaultRecipientRule: "ROLE:ADMIN",
    defaultChannels: ["IN_APP"],
    defaultMode: "DIGEST",
  },
  "dsr.issue.flagged": {
    label: "Site issue flagged",
    defaultRecipientRule: "ROLE:ADMIN",
    defaultChannels: ["EMAIL", "IN_APP"],
    defaultMode: "IMMEDIATE",
  },
  "stock.low": {
    label: "Stock low",
    defaultRecipientRule: "ROLE:ADMIN",
    defaultChannels: ["EMAIL", "IN_APP"],
    defaultMode: "DIGEST",
  },
  "user.created": {
    label: "Welcome to MAQUIN Engineering Services",
    defaultRecipientRule: "USER:userId",
    defaultChannels: ["EMAIL", "IN_APP"],
    defaultMode: "IMMEDIATE",
  },
  "auth.login.failed": {
    label: "Repeated failed sign-ins",
    defaultRecipientRule: "ROLE:ADMIN",
    defaultChannels: ["EMAIL", "IN_APP"],
    defaultMode: "IMMEDIATE",
  },
} as const satisfies Record<string, NotificationEventDef>;

export type NotificationEventKey = keyof typeof NOTIFICATION_EVENTS;

export const NOTIFICATION_EVENT_KEYS = Object.keys(NOTIFICATION_EVENTS) as NotificationEventKey[];

// The synthetic event the webmaster "Send test notification" panel uses. NOT in the
// catalog (it has no settings row and is never auto-emitted) — it drives the full
// pipeline end-to-end to the actor for a config smoke-test.
export const TEST_EVENT_KEY = "notification.test";

/** Title-case any dotted event key — fallback label for keys outside the catalog. */
export function humanizeEvent(eventKey: string): string {
  const known = (NOTIFICATION_EVENTS as Record<string, NotificationEventDef>)[eventKey];
  if (known) return known.label;
  return eventKey
    .split(/[._]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
