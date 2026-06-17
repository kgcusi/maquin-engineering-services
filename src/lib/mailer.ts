import type { ReactElement } from "react";
import { render } from "@react-email/components";
import { Resend } from "resend";

// Resend + React Email (docs/16 §4). Templates are React components under
// src/emails/.
//
// Credentials resolve from the WEBMASTER-managed Settings → Email delivery values
// (passed in as `apiKey`/`from` by the dispatcher via getResendCredentials), with
// the env vars as a fallback — matching .env.example's "Preferred: set at runtime
// in System Settings" note. A per-key client cache avoids re-instantiating Resend
// on every send within a process.
const clients = new Map<string, Resend>();

function resend(apiKey: string): Resend {
  let client = clients.get(apiKey);
  if (!client) {
    client = new Resend(apiKey);
    clients.set(apiKey, client);
  }
  return client;
}

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  react: ReactElement;
  from?: string;
  /** Resend API key. Falls back to RESEND_API_KEY when omitted. */
  apiKey?: string;
};

export async function sendEmail({ to, subject, react, from, apiKey }: SendEmailInput) {
  const key = apiKey ?? process.env.RESEND_API_KEY;
  if (!key) throw new Error("No Resend API key configured (Settings → Email delivery).");

  const fromAddress = from ?? process.env.EMAIL_FROM;
  if (!fromAddress) throw new Error("No sender address configured (Settings → Email delivery).");

  const [html, text] = await Promise.all([render(react), render(react, { plainText: true })]);

  return resend(key).emails.send({
    from: fromAddress,
    to,
    subject,
    html,
    text,
  });
}

export type ResendCheck =
  | { ok: true; restricted: boolean; domains: { name: string; status: string }[] }
  | { ok: false; reason: string };

// Validate a Resend API key WITHOUT sending email: list the account's domains.
// The SDK returns a { data, error } union (it does not throw on auth failure), so
// we map the error code to a verdict. A "restricted_api_key" (sending-only) key is
// still valid for sending — it just can't read domains — so we report it as ok.
export async function checkResendConnection(apiKey: string): Promise<ResendCheck> {
  const result = await new Resend(apiKey).domains.list();
  if (result.error) {
    const { name, message } = result.error;
    if (name === "restricted_api_key") return { ok: true, restricted: true, domains: [] };
    if (name === "invalid_api_key" || name === "missing_api_key") {
      return { ok: false, reason: "Resend rejected this API key." };
    }
    return { ok: false, reason: message || "Could not reach Resend." };
  }
  const domains = (result.data?.data ?? []).map((d) => ({ name: d.name, status: d.status }));
  return { ok: true, restricted: false, domains };
}
