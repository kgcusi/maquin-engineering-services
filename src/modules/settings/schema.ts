import { z } from "zod";

import { CURRENCY_CODES, TIMEZONE_CODES } from "@/lib/settings";

// Shared by the client form (zodResolver) and the Server Action guard — pure, no
// server deps. Each value is validated against its code-owned registry tuple.
export const updateSettingsSchema = z.object({
  timezone: z.enum(TIMEZONE_CODES),
  currency: z.enum(CURRENCY_CODES),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

// A Resend "from" can be a bare address or a display-name form
// ("MAQUIN <no-reply@firm.com>"). Validate the address portion either way.
function isValidSender(value: string): boolean {
  const match = value.match(/<([^>]+)>\s*$/);
  const address = (match ? match[1] : value).trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address);
}

// Email-delivery (Resend) credentials. Both fields are optional on submit: an
// EMPTY string means "leave the stored value unchanged" — critical for the API
// key, which the form never echoes back, so a blank field must not wipe it.
export const updateEmailSettingsSchema = z.object({
  fromAddress: z
    .string()
    .trim()
    .max(255)
    .refine((v) => v === "" || isValidSender(v), {
      message: "Use an email or “Name <email@domain>”.",
    }),
  apiKey: z
    .string()
    .trim()
    .max(255)
    .refine((v) => v === "" || v.startsWith("re_"), {
      message: "Resend API keys start with “re_”.",
    }),
});

export type UpdateEmailSettingsInput = z.infer<typeof updateEmailSettingsSchema>;
