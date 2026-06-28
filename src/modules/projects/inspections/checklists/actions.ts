"use server";

import { eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import { inspectionChecklistItems, inspectionChecklists } from "@/db/schema/inspection-checklists";
import { orNull } from "@/lib/action-helpers";
import { audit } from "@/lib/audit";
import { cacheTags, revalidate } from "@/lib/events";
import { ActionError, actionNoTx } from "@/lib/rbac";

import { CHECKLIST_ENTITY } from "./domain";
import { checklistIdSchema, createChecklistSchema, updateChecklistSchema } from "./schema";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

type ItemInput = { label: string; guidance?: string };

async function writeItems(tx: Tx, checklistId: string, items: ItemInput[]): Promise<void> {
  if (!items.length) return;
  await tx.insert(inspectionChecklistItems).values(
    items.map((it, i) => ({
      checklistId,
      label: it.label,
      guidance: orNull(it.guidance),
      sequence: i,
    })),
  );
}

// actionNoTx + explicit tx so the cache `revalidate` runs AFTER commit (mirrors
// the settings/templates pattern) — invalidating mid-transaction could re-cache a
// stale read.
export const createChecklistAction = actionNoTx(
  "checklist.manage",
  createChecklistSchema,
  async (input, { user: actor, db }) => {
    const id = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(inspectionChecklists)
        .values({
          name: input.name,
          category: orNull(input.category),
          description: orNull(input.description),
          isActive: input.isActive,
          createdBy: actor.id,
        })
        .returning({ id: inspectionChecklists.id });
      await writeItems(tx, created.id, input.items);
      await audit(tx, {
        actorId: actor.id,
        action: "checklist.created",
        entityType: CHECKLIST_ENTITY,
        entityId: created.id,
        summary: `Created inspection checklist — ${input.name}`,
        diff: { items: input.items.length },
      });
      return created.id;
    });
    revalidate(cacheTags.checklists);
    return { id };
  },
);

export const updateChecklistAction = actionNoTx(
  "checklist.manage",
  updateChecklistSchema,
  async (input, { user: actor, db }) => {
    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: inspectionChecklists.id })
        .from(inspectionChecklists)
        .where(eq(inspectionChecklists.id, input.id))
        .limit(1);
      if (!existing) throw new ActionError("Checklist not found.");

      await tx
        .update(inspectionChecklists)
        .set({
          name: input.name,
          category: orNull(input.category),
          description: orNull(input.description),
          isActive: input.isActive,
          updatedAt: new Date(),
        })
        .where(eq(inspectionChecklists.id, input.id));
      // Replace the whole item set.
      await tx
        .delete(inspectionChecklistItems)
        .where(eq(inspectionChecklistItems.checklistId, input.id));
      await writeItems(tx, input.id, input.items);

      await audit(tx, {
        actorId: actor.id,
        action: "checklist.updated",
        entityType: CHECKLIST_ENTITY,
        entityId: input.id,
        summary: `Updated inspection checklist — ${input.name}`,
        diff: { items: input.items.length },
      });
    });
    revalidate(cacheTags.checklists);
    return { id: input.id };
  },
);

export const deleteChecklistAction = actionNoTx(
  "checklist.manage",
  checklistIdSchema,
  async (input, { user: actor, db }) => {
    const changed = await db.transaction(async (tx) => {
      const [target] = await tx
        .select({ name: inspectionChecklists.name, deletedAt: inspectionChecklists.deletedAt })
        .from(inspectionChecklists)
        .where(eq(inspectionChecklists.id, input.id))
        .limit(1);
      if (!target || target.deletedAt) return false;
      await tx
        .update(inspectionChecklists)
        .set({ deletedAt: new Date() })
        .where(eq(inspectionChecklists.id, input.id));
      await audit(tx, {
        actorId: actor.id,
        action: "checklist.deleted",
        entityType: CHECKLIST_ENTITY,
        entityId: input.id,
        summary: `Deleted inspection checklist — ${target.name}`,
      });
      return true;
    });
    if (changed) revalidate(cacheTags.checklists);
    return { ok: true };
  },
);
