import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import { user } from "@/db/schema/auth";
import { attachments } from "@/db/schema/attachments";
import { files } from "@/db/schema/files";
import { audit } from "@/lib/audit";
import { ActionError } from "@/lib/rbac";
import { deleteObject, objectExists, presignDownload, presignUpload } from "@/lib/storage";
import { buildFileKey, formatBytes, isAllowedMime, MAX_UPLOAD_BYTES } from "@/lib/uploads";

// Reusable, polymorphic file/attachment pipeline over R2 + the files/attachments
// tables (docs/17 §1, docs/16 §5). Auth-less and entity-agnostic: each CONSUMER
// (clients today; DSR photos / expense receipts later) wraps these in its own
// permission-guarded action and supplies the audit `action`/`summary`. Every
// function takes the full `db` and opens its own transaction where needed, so
// callers use `actionNoTx` (no ambient transaction).

export type AttachmentRow = {
  attachmentId: string;
  fileId: string;
  filename: string;
  mime: string;
  size: number;
  label: string | null;
  kind: string | null;
  uploadedByName: string | null;
  createdAt: Date;
};

type AuditParams = { actorId: string; auditAction: string; auditSummary: string };
type EntityRef = { entityType: string; entityId: string };

/**
 * Step 1 of the upload: re-enforce the mime/size guards server-side, create the
 * PENDING `files` row, and return a presigned PUT URL for the direct browser
 * upload. The attachment link is created only at confirm, so an abandoned upload
 * leaves just an orphan PENDING file (cleaned by the future job), not a dangling link.
 */
export async function createPendingUpload(
  db: Database,
  params: EntityRef & { filename: string; mime: string; size: number; uploadedBy: string },
): Promise<{ fileId: string; url: string }> {
  if (!isAllowedMime(params.mime)) throw new ActionError("That file type isn't allowed.");
  if (params.size <= 0) throw new ActionError("That file looks empty.");
  if (params.size > MAX_UPLOAD_BYTES) {
    throw new ActionError(`File is too large (max ${formatBytes(MAX_UPLOAD_BYTES)}).`);
  }

  const fileId = randomUUID();
  const key = buildFileKey(params.entityType, params.entityId, fileId, params.filename);
  const url = await presignUpload(key, params.mime, params.size);

  await db.insert(files).values({
    id: fileId,
    key,
    filename: params.filename,
    mime: params.mime,
    size: params.size,
    status: "PENDING",
    uploadedBy: params.uploadedBy,
  });

  return { fileId, url };
}

/**
 * Step 2: HEAD the object to prove it landed (docs/17 §5), then atomically mark
 * the file CONFIRMED, create the attachment link, and audit — all in one tx.
 */
export async function confirmAttachment(
  db: Database,
  params: EntityRef & AuditParams & { fileId: string; label?: string | null; kind?: string | null },
): Promise<{ attachmentId: string }> {
  const [file] = await db
    .select({ id: files.id, key: files.key, status: files.status, filename: files.filename })
    .from(files)
    .where(eq(files.id, params.fileId))
    .limit(1);

  if (!file) throw new ActionError("Upload not found.");
  // The presigned key embeds the entity it was issued for — refuse to attach it
  // to a different record (a confused-deputy guard).
  if (!file.key.startsWith(`${params.entityType}/${params.entityId}/`)) {
    throw new ActionError("This upload doesn't belong to this record.");
  }
  if (file.status === "CONFIRMED") throw new ActionError("This file was already saved.");
  if (!(await objectExists(file.key))) {
    throw new ActionError("We couldn't find the uploaded file. Please try the upload again.");
  }

  return db.transaction(async (tx) => {
    await tx.update(files).set({ status: "CONFIRMED" }).where(eq(files.id, params.fileId));
    const [attachment] = await tx
      .insert(attachments)
      .values({
        entityType: params.entityType,
        entityId: params.entityId,
        fileId: params.fileId,
        label: params.label ?? null,
        kind: params.kind ?? null,
        createdBy: params.actorId,
      })
      .returning({ id: attachments.id });

    await audit(tx, {
      actorId: params.actorId,
      action: params.auditAction,
      entityType: params.entityType,
      entityId: params.entityId,
      summary: params.auditSummary,
      diff: { filename: file.filename, label: params.label ?? null },
    });

    return { attachmentId: attachment.id };
  });
}

/** Confirmed attachments for an entity, newest first, with uploader name. */
export async function listAttachments(
  db: Database,
  entityType: string,
  entityId: string,
): Promise<AttachmentRow[]> {
  return db
    .select({
      attachmentId: attachments.id,
      fileId: files.id,
      filename: files.filename,
      mime: files.mime,
      size: files.size,
      label: attachments.label,
      kind: attachments.kind,
      uploadedByName: user.name,
      createdAt: attachments.createdAt,
    })
    .from(attachments)
    .innerJoin(files, eq(attachments.fileId, files.id))
    .leftJoin(user, eq(attachments.createdBy, user.id))
    .where(
      and(
        eq(attachments.entityType, entityType),
        eq(attachments.entityId, entityId),
        eq(files.status, "CONFIRMED"),
      ),
    )
    .orderBy(desc(attachments.createdAt));
}

/** Short-lived presigned GET, scoped to the parent entity (defense in depth). */
export async function getAttachmentDownloadUrl(
  db: Database,
  params: EntityRef & { attachmentId: string },
): Promise<{ url: string; filename: string }> {
  const [row] = await db
    .select({ key: files.key, filename: files.filename })
    .from(attachments)
    .innerJoin(files, eq(attachments.fileId, files.id))
    .where(
      and(
        eq(attachments.id, params.attachmentId),
        eq(attachments.entityType, params.entityType),
        eq(attachments.entityId, params.entityId),
      ),
    )
    .limit(1);
  if (!row) throw new ActionError("File not found.");
  const url = await presignDownload(row.key);
  return { url, filename: row.filename };
}

/** Remove an attachment + its file row (audited), then best-effort R2 delete. */
export async function removeAttachment(
  db: Database,
  params: EntityRef & AuditParams & { attachmentId: string },
): Promise<void> {
  const [row] = await db
    .select({ fileId: files.id, key: files.key, filename: files.filename })
    .from(attachments)
    .innerJoin(files, eq(attachments.fileId, files.id))
    .where(
      and(
        eq(attachments.id, params.attachmentId),
        eq(attachments.entityType, params.entityType),
        eq(attachments.entityId, params.entityId),
      ),
    )
    .limit(1);
  if (!row) throw new ActionError("File not found.");

  await db.transaction(async (tx) => {
    await tx.delete(attachments).where(eq(attachments.id, params.attachmentId));
    await tx.delete(files).where(eq(files.id, row.fileId));
    await audit(tx, {
      actorId: params.actorId,
      action: params.auditAction,
      entityType: params.entityType,
      entityId: params.entityId,
      summary: params.auditSummary,
      diff: { filename: row.filename },
    });
  });

  // Best-effort R2 cleanup AFTER commit — a failure here only orphans the object
  // (the cleanup job handles those), it never leaves a broken record.
  try {
    await deleteObject(row.key);
  } catch (err) {
    console.error("[files.removeAttachment] R2 delete failed (orphan left)", err);
  }
}
