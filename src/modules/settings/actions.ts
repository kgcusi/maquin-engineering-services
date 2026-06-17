"use server";

import { z } from "zod";

import { appSettings } from "@/db/schema/app-settings";
import { audit } from "@/lib/audit";
import { cacheTags, revalidate } from "@/lib/events";
import { checkResendConnection } from "@/lib/mailer";
import { ActionError, actionNoTx } from "@/lib/rbac";
import { DEFAULT_SETTINGS, SETTINGS_KEYS, type SettingKey } from "@/lib/settings";

import { getResendCredentials } from "./queries";
import { updateEmailSettingsSchema, updateSettingsSchema } from "./schema";

// WEBMASTER-only (settings.manage is excluded from the ADMIN bundle). Upserts only
// the changed keys, audits the change, then invalidates the cached reader AFTER
// commit so the next getSettings() refetches. Uses actionNoTx + an explicit
// transaction so revalidate() runs post-commit — calling it mid-transaction could
// re-cache a value another request read before this write landed.
export const updateSettingsAction = actionNoTx(
  "settings.manage",
  updateSettingsSchema,
  async (input, { user: actor, db }) => {
    const changed = await db.transaction(async (tx) => {
      const rows = await tx.select().from(appSettings);
      const current: Record<string, unknown> = { ...DEFAULT_SETTINGS };
      for (const row of rows) current[row.key] = row.value;

      const diff: Record<string, { from: unknown; to: unknown }> = {};
      for (const key of SETTINGS_KEYS) {
        if (current[key] !== input[key]) diff[key] = { from: current[key], to: input[key] };
      }
      if (Object.keys(diff).length === 0) return false;

      for (const key of Object.keys(diff) as SettingKey[]) {
        await tx
          .insert(appSettings)
          .values({ key, value: input[key] })
          .onConflictDoUpdate({
            target: appSettings.key,
            set: { value: input[key], updatedAt: new Date() },
          });
      }

      await audit(tx, {
        actorId: actor.id,
        action: "settings.updated",
        entityType: "settings",
        entityId: null,
        summary: "Updated system settings",
        diff,
      });
      return true;
    });

    if (changed) revalidate(cacheTags.settings);
    return { changed };
  },
);

// WEBMASTER-only. Stores the Resend "from" address + API key in app_settings. An
// empty field means "keep the stored value" (the form never echoes the key back,
// so a blank key must not erase it). The API key is a SECRET: it never goes
// through the cached getSettings() reader, and the audit diff REDACTS it — we log
// only that it changed, never the value. No cache invalidation: the email config
// is read live (getEmailConfig), not from the `settings` cache tag.
export const updateEmailSettingsAction = actionNoTx(
  "settings.manage",
  updateEmailSettingsSchema,
  async (input, { user: actor, db }) => {
    const changed = await db.transaction(async (tx) => {
      const rows = await tx.select().from(appSettings);
      const byKey = new Map(rows.map((row) => [row.key, row.value]));
      const fromRaw = byKey.get("email_from");
      const keyRaw = byKey.get("resend_api_key");
      const currentFrom = typeof fromRaw === "string" ? fromRaw : "";
      const currentKey = typeof keyRaw === "string" ? keyRaw : "";

      const diff: Record<string, { from: unknown; to: unknown }> = {};

      const upsert = (key: string, value: string) =>
        tx
          .insert(appSettings)
          .values({ key, value })
          .onConflictDoUpdate({
            target: appSettings.key,
            set: { value, updatedAt: new Date() },
          });

      if (input.fromAddress !== "" && input.fromAddress !== currentFrom) {
        await upsert("email_from", input.fromAddress);
        diff.email_from = { from: currentFrom || null, to: input.fromAddress };
      }
      if (input.apiKey !== "" && input.apiKey !== currentKey) {
        await upsert("resend_api_key", input.apiKey);
        // Redacted on purpose — never log the secret value.
        diff.resend_api_key = { from: currentKey ? "configured" : "not set", to: "updated" };
      }

      if (Object.keys(diff).length === 0) return false;

      await audit(tx, {
        actorId: actor.id,
        action: "settings.updated",
        entityType: "settings",
        entityId: null,
        summary: "Updated email delivery settings",
        diff,
      });
      return true;
    });

    return { changed };
  },
);

// WEBMASTER-only. Validates the SAVED Resend key against the API without sending
// any email (lists domains). Goes through the guarded wrapper like every action,
// but performs no DB mutation. Surfaces verified sending domains so the webmaster
// can confirm the "from" address will deliver.
export const testEmailConnectionAction = actionNoTx("settings.manage", z.object({}), async () => {
  const { apiKey } = await getResendCredentials();
  if (!apiKey) throw new ActionError("Add and save a Resend API key first.");

  const result = await checkResendConnection(apiKey);
  if (!result.ok) throw new ActionError(result.reason);

  return { restricted: result.restricted, domains: result.domains };
});
