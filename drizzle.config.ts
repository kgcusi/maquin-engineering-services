import "./src/db/load-env"; // drizzle-kit doesn't auto-load .env — shared silent loader does it

import { defineConfig } from "drizzle-kit";

// You only manage ONE connection string: DATABASE_URL. The app runtime uses it
// as-is — Neon's POOLED endpoint is correct for serverless (see src/db/client.ts,
// prepare:false). Drizzle Kit, however, should talk to Neon's DIRECT endpoint
// (migrations don't belong on the PgBouncer pooler). Neon's two URLs are identical
// except the pooled host carries a "-pooler" suffix, so we derive the direct URL
// by stripping it. Set DATABASE_URL_UNPOOLED explicitly only if you want to
// override that. (docs/16 §2: app → pooled, migrations → direct.)
// `||` (not `??`) so a present-but-EMPTY `DATABASE_URL_UNPOOLED=` line also falls
// through to derivation instead of silently becoming an empty url.
const migrationUrl =
  process.env.DATABASE_URL_UNPOOLED || (process.env.DATABASE_URL || "").replace("-pooler.", ".");

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: { url: migrationUrl },
  strict: true,
  verbose: true,
});
