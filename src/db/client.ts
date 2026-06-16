import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

// ── The single most important infra detail in this build ───────────────────
// The inventory ledger requires multi-statement transactions (post N ledger
// rows + update balances + write approval + audit, atomically). That demands a
// transaction-capable driver:
//   ✅ drizzle-orm/postgres-js  (used here)
//   ❌ drizzle-orm/neon-http    (cannot do interactive multi-statement txns)
//
// Neon's POOLED endpoint is PgBouncer in *transaction* mode, which breaks
// prepared statements — so `prepare: false` is mandatory. Without it you get
// intermittent runtime errors under load, not at build time.
// See docs/16-tech-decisions.md §2 and docs/01-architecture.md §5.2.
// ───────────────────────────────────────────────────────────────────────────

const connectionString = process.env.DATABASE_URL ?? "";

// Reuse one postgres connection across HMR reloads in dev to avoid exhausting
// the pool with a new client on every hot reload.
const globalForDb = globalThis as unknown as {
  __pmtisSql?: ReturnType<typeof postgres>;
};

const sql = globalForDb.__pmtisSql ?? postgres(connectionString, { prepare: false });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__pmtisSql = sql;
}

export const db = drizzle(sql, { schema });

export type Database = typeof db;
