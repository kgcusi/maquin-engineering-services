// Code-owned registry for the runtime-editable app settings (timezone + currency).
// Pure — NO server imports (no db, no next/headers) — so the client settings form,
// the cached reader, and the Zod action schema share one source of truth (mirrors
// src/lib/lookups.ts). Array order IS the display order. Adding an option is a
// one-line edit here; the value is a plain text code validated against these sets.

type CodedEntry = { readonly code: string; readonly label: string };

// Codes as a Zod-ready tuple: `z.enum(TIMEZONE_CODES)` in the module schema.
function codesOf<const T extends CodedEntry>(entries: readonly T[]): [T["code"], ...T["code"][]] {
  return entries.map((e) => e.code) as [T["code"], ...T["code"][]];
}

function labelLookup<T extends CodedEntry>(entries: readonly T[]) {
  const map = new Map(entries.map((e) => [e.code, e.label]));
  return (code: string | null | undefined): string => (code ? (map.get(code) ?? code) : "—");
}

// ── Timezones (IANA) ─────────────────────────────────────────────────────────
// The firm operates in the Philippines, so Asia/Manila leads; the rest is a
// focused regional + global set, not the full tz database. Offsets in the label
// are display hints only — the actual zone math always uses the IANA code.
export const TIMEZONES = [
  { code: "Asia/Manila", label: "Manila (PHT, UTC+8)" },
  { code: "Asia/Singapore", label: "Singapore (UTC+8)" },
  { code: "Asia/Hong_Kong", label: "Hong Kong (UTC+8)" },
  { code: "Asia/Kuala_Lumpur", label: "Kuala Lumpur (UTC+8)" },
  { code: "Asia/Shanghai", label: "Shanghai (UTC+8)" },
  { code: "Asia/Tokyo", label: "Tokyo (UTC+9)" },
  { code: "Asia/Jakarta", label: "Jakarta (UTC+7)" },
  { code: "Asia/Bangkok", label: "Bangkok (UTC+7)" },
  { code: "Asia/Kolkata", label: "Kolkata (UTC+5:30)" },
  { code: "Asia/Dubai", label: "Dubai (UTC+4)" },
  { code: "Australia/Sydney", label: "Sydney (UTC+10/+11)" },
  { code: "Europe/London", label: "London (UTC+0/+1)" },
  { code: "Europe/Paris", label: "Paris (UTC+1/+2)" },
  { code: "America/New_York", label: "New York (UTC−5/−4)" },
  { code: "America/Los_Angeles", label: "Los Angeles (UTC−8/−7)" },
  { code: "UTC", label: "UTC" },
] as const;

export type TimezoneCode = (typeof TIMEZONES)[number]["code"];
export const TIMEZONE_CODES = codesOf(TIMEZONES);
export const timezoneLabel = labelLookup(TIMEZONES);

// ── Currencies (ISO 4217) ────────────────────────────────────────────────────
// PHP is the firm default and feeds formatMoney() (src/lib/money.ts).
export const CURRENCIES = [
  { code: "PHP", label: "Philippine Peso (₱)" },
  { code: "USD", label: "US Dollar ($)" },
  { code: "EUR", label: "Euro (€)" },
  { code: "JPY", label: "Japanese Yen (¥)" },
  { code: "SGD", label: "Singapore Dollar (S$)" },
  { code: "AUD", label: "Australian Dollar (A$)" },
  { code: "GBP", label: "British Pound (£)" },
  { code: "HKD", label: "Hong Kong Dollar (HK$)" },
  { code: "AED", label: "UAE Dirham (AED)" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];
export const CURRENCY_CODES = codesOf(CURRENCIES);
export const currencyLabel = labelLookup(CURRENCIES);

// ── The settings shape + defaults ────────────────────────────────────────────
// `app_settings` is a key/value store; this is the typed projection the app reads.
// Defaults back-fill any key that's never been written (and any value that fails
// validation on read).
export type AppSettings = {
  timezone: TimezoneCode;
  currency: CurrencyCode;
};

export const DEFAULT_SETTINGS: AppSettings = {
  timezone: "Asia/Manila",
  currency: "PHP",
};

export const SETTINGS_KEYS = [
  "timezone",
  "currency",
] as const satisfies readonly (keyof AppSettings)[];
export type SettingKey = (typeof SETTINGS_KEYS)[number];
