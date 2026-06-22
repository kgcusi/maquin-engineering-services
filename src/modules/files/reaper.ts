import { and, eq, lt } from "drizzle-orm";

import type { Database } from "@/db/client";
import { files } from "@/db/schema/files";
import { deleteObject } from "@/lib/storage";

// Orphan-file reaper (anticipated by service.ts:createPendingUpload). An upload that
// presigns + PUTs but never confirms — an abandoned DSR photo / document pick, or a
// browser closed mid-upload — leaves a PENDING `files` row and an R2 object with no
// attachment. This sweeps PENDING rows older than the grace window: best-effort R2
// delete, then drop the row. CONFIRMED files are never touched.
const STALE_HOURS = 24;
const SWEEP_LIMIT = 500;

export async function runFileReaper(db: Database): Promise<{ swept: number }> {
  const cutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000);

  const stale = await db
    .select({ id: files.id, key: files.key })
    .from(files)
    .where(and(eq(files.status, "PENDING"), lt(files.createdAt, cutoff)))
    .limit(SWEEP_LIMIT);

  let swept = 0;
  for (const file of stale) {
    try {
      await deleteObject(file.key); // idempotent; a never-PUT key just no-ops
    } catch (err) {
      console.error("[files.reaper] R2 delete failed (object orphaned)", err);
    }
    await db.delete(files).where(eq(files.id, file.id));
    swept += 1;
  }

  return { swept };
}
