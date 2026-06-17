import "./load-env"; // MUST be first — loads .env.local before ./client and ../lib/auth read process.env

import { eq } from "drizzle-orm";

import { auth } from "../lib/auth";
import { NOTIFICATION_EVENTS, NOTIFICATION_EVENT_KEYS } from "../lib/notification-events";
import { db } from "./client";
import { user } from "./schema/auth";
import { notificationSettings } from "./schema/notification-settings";

// Seed the two bootstrap accounts. Idempotent (skips existing emails), so it is
// safe to re-run. Credentials come from env (.env.local) — run with `pnpm db:seed`,
// which needs DATABASE_URL + BETTER_AUTH_SECRET set.
//
// Relative imports only: this runs under tsx, which does not resolve the `@/` alias.

type SeedUser = {
  envPrefix: "SEED_WEBMASTER" | "SEED_ADMIN";
  role: "WEBMASTER" | "ADMIN";
  defaultName: string;
  label: string;
};

// WEBMASTER is the hidden superuser (docs: full access, never shown in any user
// listing — managed only here / via the DB). ADMIN is the normal top role.
const SEED_USERS: SeedUser[] = [
  {
    envPrefix: "SEED_WEBMASTER",
    role: "WEBMASTER",
    defaultName: "System",
    label: "webmaster (hidden)",
  },
  {
    envPrefix: "SEED_ADMIN",
    role: "ADMIN",
    defaultName: "Administrator",
    label: "admin",
  },
];

async function ensureUser(seed: SeedUser): Promise<void> {
  const email = process.env[`${seed.envPrefix}_EMAIL`];
  const password = process.env[`${seed.envPrefix}_PASSWORD`];
  const name = process.env[`${seed.envPrefix}_NAME`] ?? seed.defaultName;

  if (!email || !password) {
    console.warn(
      `↷ ${seed.label}: ${seed.envPrefix}_EMAIL / ${seed.envPrefix}_PASSWORD not set — skipping`,
    );
    return;
  }

  const existing = await db.query.user.findFirst({
    where: eq(user.email, email),
  });
  if (existing) {
    console.log(`✓ ${seed.label} already exists (${email}) — skipping`);
    return;
  }

  // Called with no headers/request, which lets the admin endpoint create the
  // first user without an existing admin session (better-auth@1.6.18).
  await auth.api.createUser({
    body: {
      email,
      password,
      name,
      // better-auth types `role` to its default user/admin union (we set no
      // access-control `roles` config); the column is free text and accepts our
      // custom roles at runtime, so assert through unknown.
      role: seed.role as unknown as "admin",
      // isActive is an `input: false` field defaulting to true — passing it is
      // ignored, so we don't.
    },
  });
  console.log(`＋ ${seed.label} created (${email}, role=${seed.role})`);
}

// Ensure one notification_settings row per catalog event (docs/08 §3). Seeded
// INERT — `enabled: false`, IN_APP only — so the data-driven catalog exists but
// nothing emails anyone until the firm turns an event on. Idempotent: existing
// rows are left untouched, so a re-run never clobbers firm edits.
async function ensureNotificationSettings(): Promise<void> {
  for (const key of NOTIFICATION_EVENT_KEYS) {
    const def = NOTIFICATION_EVENTS[key];
    await db
      .insert(notificationSettings)
      .values({
        eventKey: key,
        enabled: false,
        channels: ["IN_APP"],
        recipientRule: def.defaultRecipientRule,
        mode: def.defaultMode,
      })
      .onConflictDoNothing({ target: notificationSettings.eventKey });
  }
  console.log(`✓ notification settings ensured (${NOTIFICATION_EVENT_KEYS.length} events, inert)`);
}

async function main(): Promise<void> {
  console.log("Seeding bootstrap users…");
  for (const seed of SEED_USERS) {
    await ensureUser(seed);
  }
  await ensureNotificationSettings();
  console.log("Seed complete.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
