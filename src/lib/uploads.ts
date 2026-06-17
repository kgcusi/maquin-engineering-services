// Pure upload policy — MIME allowlist, size cap, and the R2 key builder. NO server
// imports, so the client uploader, the Zod action schemas, and the server file
// service all share one source of truth (docs/13 §4). Browser uploads go DIRECT to
// R2 via a presigned PUT; these same guards are re-enforced server-side at presign.

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB (docs/13 §4: 10–20 MB cap)

// MIME → friendly label, for the picker hint and error copy. Covers the directory's
// document use (PDF / Office) plus images for the photo galleries that come later.
export const ALLOWED_MIME: Record<string, string> = {
  "image/png": "PNG image",
  "image/jpeg": "JPEG image",
  "image/webp": "WebP image",
  "image/gif": "GIF image",
  "application/pdf": "PDF",
  "application/msword": "Word document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word document",
  "application/vnd.ms-excel": "Excel spreadsheet",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel spreadsheet",
};

export const ALLOWED_MIME_TYPES = Object.keys(ALLOWED_MIME) as [string, ...string[]];

// `accept` attribute for <input type="file"> built from the allowlist.
export const UPLOAD_ACCEPT = ALLOWED_MIME_TYPES.join(",");

export function isAllowedMime(mime: string): boolean {
  return mime in ALLOWED_MIME;
}

// Human-readable size for UI + error messages.
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

// Sanitize a filename to a safe, bounded slug (extension preserved) for the R2 key.
export function safeFilename(filename: string): string {
  const trimmed = filename.trim().slice(-200);
  const cleaned = trimmed.replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_");
  return cleaned.replace(/^_+|_+$/g, "") || "file";
}

// R2 object key: "<entityType>/<entityId>/<fileId>/<safeName>" — groups an entity's
// files together; the fileId segment guarantees global uniqueness.
export function buildFileKey(
  entityType: string,
  entityId: string,
  fileId: string,
  filename: string,
): string {
  return `${entityType}/${entityId}/${fileId}/${safeFilename(filename)}`;
}
