import { and, count, desc, eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import { user } from "@/db/schema/auth";
import { notes } from "@/db/schema/notes";
import { audit } from "@/lib/audit";
import { ActionError } from "@/lib/rbac";
import { offsetFor, type Paginated } from "@/modules/shared/list-params";

// Reusable, polymorphic notes over the `notes` table (docs/17 §1). Like the file
// service: auth-less and entity-agnostic; each consumer wraps these in a
// permission-guarded action and supplies the audit `action`/`summary`. Functions
// take the full `db` and own their transaction → call from `actionNoTx`.

export type NoteRow = {
  id: string;
  body: string;
  authorName: string | null;
  createdAt: Date;
};

type AuditParams = { actorId: string; auditAction: string; auditSummary: string };
type EntityRef = { entityType: string; entityId: string };

/** One page of notes for an entity, newest first, with author name (null if
 *  archived) and the full-set total for the tab count + pagination footer. */
export async function listNotes(
  db: Database,
  entityType: string,
  entityId: string,
  page: number,
  pageSize: number,
): Promise<Paginated<NoteRow>> {
  const where = and(eq(notes.entityType, entityType), eq(notes.entityId, entityId));

  const [rows, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: notes.id,
        body: notes.body,
        authorName: user.name,
        createdAt: notes.createdAt,
      })
      .from(notes)
      .leftJoin(user, eq(notes.createdBy, user.id))
      .where(where)
      .orderBy(desc(notes.createdAt))
      .limit(pageSize)
      .offset(offsetFor(page, pageSize)),
    db.select({ value: count() }).from(notes).where(where),
  ]);

  return { rows, total, page, pageSize };
}

export async function addNote(
  db: Database,
  params: EntityRef & AuditParams & { body: string },
): Promise<{ noteId: string }> {
  return db.transaction(async (tx) => {
    const [note] = await tx
      .insert(notes)
      .values({
        entityType: params.entityType,
        entityId: params.entityId,
        body: params.body,
        createdBy: params.actorId,
      })
      .returning({ id: notes.id });

    await audit(tx, {
      actorId: params.actorId,
      action: params.auditAction,
      entityType: params.entityType,
      entityId: params.entityId,
      summary: params.auditSummary,
      diff: { note: params.body },
    });

    return { noteId: note.id };
  });
}

export async function removeNote(
  db: Database,
  params: EntityRef & AuditParams & { noteId: string },
): Promise<void> {
  const [note] = await db
    .select({ entityType: notes.entityType, entityId: notes.entityId, body: notes.body })
    .from(notes)
    .where(eq(notes.id, params.noteId))
    .limit(1);
  // Scope the lookup to the parent entity so one consumer can't delete another's note.
  if (!note || note.entityType !== params.entityType || note.entityId !== params.entityId) {
    throw new ActionError("Note not found.");
  }

  await db.transaction(async (tx) => {
    await tx.delete(notes).where(eq(notes.id, params.noteId));
    await audit(tx, {
      actorId: params.actorId,
      action: params.auditAction,
      entityType: params.entityType,
      entityId: params.entityId,
      summary: params.auditSummary,
      // Record the removed note's content so the audit event shows what was deleted.
      diff: { note: note.body },
    });
  });
}
