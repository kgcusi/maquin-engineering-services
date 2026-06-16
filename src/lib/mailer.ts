import type { ReactElement } from "react";
import { render } from "@react-email/components";
import { Resend } from "resend";

// Resend + React Email (docs/16 §4). Templates are React components under
// src/emails/ (added with notifications in Stage 1). Lazy client so a missing key
// only errors when actually sending, not at import/build.
let client: Resend | null = null;

function resend(): Resend {
  if (!client) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY is not set");
    client = new Resend(apiKey);
  }
  return client;
}

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  react: ReactElement;
  from?: string;
};

export async function sendEmail({ to, subject, react, from }: SendEmailInput) {
  const [html, text] = await Promise.all([render(react), render(react, { plainText: true })]);

  return resend().emails.send({
    from: from ?? process.env.EMAIL_FROM ?? "",
    to,
    subject,
    html,
    text,
  });
}
