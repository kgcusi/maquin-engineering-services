import { and, desc, eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import { user } from "@/db/schema/auth";
import { notes } from "@/db/schema/notes";
import { audit } from "@/lib/audit";
import { ActionError } from "@/lib/rbac";

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

/** Notes for an entity, newest first, with author name (null if archived). */
export async function listNotes(
  db: Database,
  entityType: string,
  entityId: string,
): Promise<NoteRow[]> {
  return db
    .select({
      id: notes.id,
      body: notes.body,
      authorName: user.name,
      createdAt: notes.createdAt,
    })
    .from(notes)
    .leftJoin(user, eq(notes.createdBy, user.id))
    .where(and(eq(notes.entityType, entityType), eq(notes.entityId, entityId)))
    .orderBy(desc(notes.createdAt));
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
    });

    return { noteId: note.id };
  });
}

export async function removeNote(
  db: Database,
  params: EntityRef & AuditParams & { noteId: string },
): Promise<void> {
  const [note] = await db
    .select({ entityType: notes.entityType, entityId: notes.entityId })
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
    });
  });
}
