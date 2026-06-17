// Code-owned shape for the runtime-editable email-delivery settings (Resend).
// Pure — NO server imports — so the client form, the page-facing read projection,
// and the Zod action schema share one source of truth (mirrors src/lib/settings.ts).
//
// The Resend API key is a SECRET: it is stored in app_settings but NEVER returned
// to the client raw and NEVER cached. getEmailConfig() exposes only a masked hint
// (this file's maskApiKey), the audit log redacts it, and the raw value is read
// server-side only by getResendCredentials() for the connection test. Actual
// email SENDING is intentionally NOT wired yet — this slice is credentials-only.

export const EMAIL_SETTINGS_KEYS = ["email_from", "resend_api_key"] as const;
export type EmailSettingKey = (typeof EMAIL_SETTINGS_KEYS)[number];

// What the settings UI is allowed to see. The raw key never crosses to the client;
// `apiKeyHint` is a display-only mask and `apiKeyConfigured` drives the status badge.
export type EmailConfigView = {
  fromAddress: string | null;
  apiKeyConfigured: boolean;
  apiKeyHint: string | null;
};

// Mask a Resend API key for display: keep the leading "re_" prefix and the last 4
// chars, bullet out the middle. Reveals too little to be usable, enough to confirm
// "this is the key I pasted". Returns null for an empty/whitespace value.
export function maskApiKey(key: string): string | null {
  const trimmed = key.trim();
  if (!trimmed) return null;
  if (trimmed.length <= 8) return "••••";
  return `${trimmed.slice(0, 3)}••••${trimmed.slice(-4)}`;
}
