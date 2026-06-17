import { cacheLife, cacheTag } from "next/cache";

import { db } from "@/db/client";
import { appSettings } from "@/db/schema/app-settings";
import { maskApiKey, type EmailConfigView } from "@/lib/email-settings";
import { CURRENCY_CODES, DEFAULT_SETTINGS, TIMEZONE_CODES, type AppSettings } from "@/lib/settings";

const TIMEZONE_SET = new Set<string>(TIMEZONE_CODES);
const CURRENCY_SET = new Set<string>(CURRENCY_CODES);

// The app's ONLY `use cache` reader (docs/16 §7): firm-wide settings are
// non-user-scoped and slow-changing, so they're the canonical opt-in. Reads
// `app_settings` only — never the session — so it's cache-safe; returns a plain
// object (serializable). Invalidated synchronously by updateSettingsAction via
// `revalidate("settings")`. Unknown/invalid stored values fall back to defaults,
// so a hand-edited or stale row can never crash a render.
export async function getSettings(): Promise<AppSettings> {
  "use cache";
  cacheLife("max");
  cacheTag("settings");

  const rows = await db.select().from(appSettings);
  const byKey = new Map(rows.map((row) => [row.key, row.value]));

  const tz = byKey.get("timezone");
  const currency = byKey.get("currency");
  return {
    timezone:
      typeof tz === "string" && TIMEZONE_SET.has(tz)
        ? (tz as AppSettings["timezone"])
        : DEFAULT_SETTINGS.timezone,
    currency:
      typeof currency === "string" && CURRENCY_SET.has(currency)
        ? (currency as AppSettings["currency"])
        : DEFAULT_SETTINGS.currency,
  };
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

// Page-facing email-delivery config. Deliberately NOT `use cache`: it derives
// from a secret (the Resend key) which must never be cached or serialized to the
// client, so it reads app_settings live. Returns only a MASKED hint — the raw key
// stays server-side. Cheap and rare (webmaster Settings screen only).
export async function getEmailConfig(): Promise<EmailConfigView> {
  const rows = await db.select().from(appSettings);
  const byKey = new Map(rows.map((row) => [row.key, row.value]));
  const apiKey = readString(byKey.get("resend_api_key"));
  return {
    fromAddress: readString(byKey.get("email_from")),
    apiKeyConfigured: apiKey !== null,
    apiKeyHint: apiKey ? maskApiKey(apiKey) : null,
  };
}

// SERVER-ONLY: returns the RAW Resend key. Only the connection-test action (and,
// later, the mailer send path) may call this — never pass the result to a client
// component or include it in an audit diff.
export async function getResendCredentials(): Promise<{
  apiKey: string | null;
  fromAddress: string | null;
}> {
  const rows = await db.select().from(appSettings);
  const byKey = new Map(rows.map((row) => [row.key, row.value]));
  return {
    apiKey: readString(byKey.get("resend_api_key")),
    fromAddress: readString(byKey.get("email_from")),
  };
}
