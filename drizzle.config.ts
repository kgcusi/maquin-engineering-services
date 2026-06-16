import { defineConfig } from "drizzle-kit";

// Drizzle Kit (generate/migrate/studio) connects DIRECTLY — use the UNPOOLED
// Neon URL. The app runtime uses the POOLED URL (see src/db/client.ts). Mixing
// these up is the classic Neon footgun. See docs/16-tech-decisions.md §2.
export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
