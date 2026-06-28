// Firm-timezone-aware date formatting. Pure (no server imports) so it's shared by
// client tables and server components. Replaces bare `Intl.DateTimeFormat(undefined,
// …)` calls so timestamps render in the firm's configured zone (the `timezone`
// app setting) once it's set — falling back to the runtime zone when none is given.

type DateStyle = "date" | "datetime";

const FORMATS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  date: { dateStyle: "medium" },
  datetime: { dateStyle: "medium", timeStyle: "short" },
};

/** Format a Date (or ISO string) in the given IANA timezone. `timeZone`
 *  `undefined` → the runtime default (e.g. before settings are available). */
export function formatDateTime(
  value: Date | string,
  timeZone?: string,
  style: DateStyle = "datetime",
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(undefined, { ...FORMATS[style], timeZone }).format(date);
}

/** "Today" as YYYY-MM-DD in the firm's timezone (NOT UTC). Drives the one-DSR-per-day
 *  key, the delayed-task scan, and completed/delayed date logic — so the day boundary
 *  matches the firm's calendar, not the server's UTC clock. `en-CA` renders ISO-style
 *  `2026-06-22`; the timeZone shifts "now" into the firm's local day. */
export function todayInTimeZone(timeZone?: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
