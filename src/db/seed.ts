import { eq } from "drizzle-orm";

import { auth } from "../lib/auth";
import { db } from "./client";
import { user } from "./schema/auth";

// Seed the two bootstrap accounts. Idempotent (skips existing emails), so it is
// safe to re-run. Credentials come from env — run with:
//   pnpm db:seed   (loads .env.local; needs DATABASE_URL + BETTER_AUTH_SECRET)
//
// Relative imports only: this runs under tsx, which does not resolve the `@/`
// alias.

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
      data: { isActive: true },
    },
  });
  console.log(`＋ ${seed.label} created (${email}, role=${seed.role})`);
}

async function main(): Promise<void> {
  console.log("Seeding bootstrap users…");
  for (const seed of SEED_USERS) {
    await ensureUser(seed);
  }
  console.log("Seed complete.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
