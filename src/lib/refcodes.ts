import { sql } from "drizzle-orm";

import type { Database } from "@/db/client";
import { refCounters } from "@/db/schema/ref-counters";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Atomically allocate the next sequential reference code for a prefix + year,
 * e.g. `nextRefCode(tx, "MR", 2026)` → `"MR-2026-00042"`. Race-safe via an upsert
 * on the ref_counters composite PK. MUST run inside a transaction (docs/01 §5.6).
 * Codes are never reused, even after cancellation.
 */
export async function nextRefCode(tx: Tx, prefix: string, year: number, pad = 5): Promise<string> {
  const [row] = await tx
    .insert(refCounters)
    .values({ prefix, year, currentValue: 1 })
    .onConflictDoUpdate({
      target: [refCounters.prefix, refCounters.year],
      set: {
        currentValue: sql`${refCounters.currentValue} + 1`,
        updatedAt: sql`now()`,
      },
    })
    .returning({ value: refCounters.currentValue });

  return `${prefix}-${year}-${row.value.toString().padStart(pad, "0")}`;
}
