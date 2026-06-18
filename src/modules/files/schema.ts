import { z } from "zod";

import { ALLOWED_MIME_TYPES, MAX_UPLOAD_BYTES } from "@/lib/uploads";

// Reusable upload field validators — composed into each consumer's presign schema
// (e.g. clients' document upload) so the parent entity id is added per-consumer.
// These mirror the server-side guards in the file service (single source: uploads.ts).
export const uploadFileFields = {
  filename: z.string().trim().min(1, "Filename is required").max(255),
  mime: z.enum(ALLOWED_MIME_TYPES, { message: "That file type isn't allowed." }),
  size: z
    .number()
    .int()
    .positive("That file looks empty.")
    .max(MAX_UPLOAD_BYTES, "File is too large (max 15 MB)."),
};

// Optional human-friendly name for an uploaded document (stored in attachments.label).
// Blank → omitted by the uploader, so the list falls back to the file's own name.
export const documentNameField = {
  name: z.string().trim().max(120, "Name is too long").optional(),
};
