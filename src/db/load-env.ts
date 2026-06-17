// Side-effect module: load env files into process.env BEFORE any module that
// reads them (e.g. ./client, ../lib/auth) is evaluated. Import it FIRST.
//
// Why this exists: Next.js auto-loads .env files, but the standalone tools don't.
// `pnpm db:seed` (tsx) and `drizzle.config.ts` (drizzle-kit) import this so all
// three paths behave identically and quietly. `.env.local` is loaded first so it
// wins over `.env` (Node's loadEnvFile does not override an already-set var),
// matching Next's precedence. Missing files are ignored silently.
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // file not present — fine
  }
}
