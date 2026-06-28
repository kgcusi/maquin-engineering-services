import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { db } from "@/db/client";
import { inspectionChecklistItems, inspectionChecklists } from "@/db/schema/inspection-checklists";

export type ChecklistItemNode = {
  id: string;
  label: string;
  guidance: string | null;
  sequence: number;
};
export type ChecklistTree = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  isActive: boolean;
  items: ChecklistItemNode[];
};

async function loadChecklistTrees(
  rows: {
    id: string;
    name: string;
    category: string | null;
    description: string | null;
    isActive: boolean;
  }[],
): Promise<ChecklistTree[]> {
  if (!rows.length) return [];
  const ids = rows.map((c) => c.id);
  const itemRows = await db
    .select({
      id: inspectionChecklistItems.id,
      checklistId: inspectionChecklistItems.checklistId,
      label: inspectionChecklistItems.label,
      guidance: inspectionChecklistItems.guidance,
      sequence: inspectionChecklistItems.sequence,
    })
    .from(inspectionChecklistItems)
    .where(inArray(inspectionChecklistItems.checklistId, ids))
    .orderBy(asc(inspectionChecklistItems.sequence));

  const byChecklist = new Map<string, ChecklistItemNode[]>();
  for (const it of itemRows) {
    const list = byChecklist.get(it.checklistId) ?? [];
    list.push({ id: it.id, label: it.label, guidance: it.guidance, sequence: it.sequence });
    byChecklist.set(it.checklistId, list);
  }
  return rows.map((c) => ({ ...c, items: byChecklist.get(c.id) ?? [] }));
}

/**
 * The inspection-time picker source — active checklists with their items. Cached
 * (firm-wide reference data, docs/16 §7); invalidated by the checklist CRUD actions
 * via `revalidate(cacheTags.checklists)`. Reads only checklist tables — never the
 * session — so it's cache-safe.
 */
export async function getActiveChecklistsWithItems(): Promise<ChecklistTree[]> {
  "use cache";
  cacheLife("max");
  cacheTag("checklists");

  const rows = await db
    .select({
      id: inspectionChecklists.id,
      name: inspectionChecklists.name,
      category: inspectionChecklists.category,
      description: inspectionChecklists.description,
      isActive: inspectionChecklists.isActive,
    })
    .from(inspectionChecklists)
    .where(and(isNull(inspectionChecklists.deletedAt), eq(inspectionChecklists.isActive, true)))
    .orderBy(asc(inspectionChecklists.name));

  return loadChecklistTrees(rows);
}

/** Admin management list (Setup → Checklists) — full trees, active AND inactive. */
export async function listChecklistsForAdmin(): Promise<ChecklistTree[]> {
  const rows = await db
    .select({
      id: inspectionChecklists.id,
      name: inspectionChecklists.name,
      category: inspectionChecklists.category,
      description: inspectionChecklists.description,
      isActive: inspectionChecklists.isActive,
    })
    .from(inspectionChecklists)
    .where(isNull(inspectionChecklists.deletedAt))
    .orderBy(asc(inspectionChecklists.name));

  return loadChecklistTrees(rows);
}
