import { z } from "zod";

import { uploadFileFields } from "@/modules/files/schema";
import { noteBodyField } from "@/modules/notes/schema";

const name = z.string().trim().min(1, "Name is required").max(160, "Name is too long");
const optionalEmail = z.union([z.literal(""), z.string().email("Enter a valid email")]).optional();

export const createClientSchema = z.object({
  name,
  contactPerson: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(40).optional(),
  email: optionalEmail,
  address: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const updateClientSchema = createClientSchema.extend({ id: z.string().uuid() });
export const clientIdSchema = z.object({ id: z.string().uuid() });

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;

// ── Client documents (file pipeline) + notes — clientId scopes every op ────────
export const presignClientDocumentSchema = z.object({
  clientId: z.string().uuid(),
  ...uploadFileFields,
});
export const confirmClientDocumentSchema = z.object({
  clientId: z.string().uuid(),
  fileId: z.string().uuid(),
});
export const clientDocumentIdSchema = z.object({
  clientId: z.string().uuid(),
  attachmentId: z.string().uuid(),
});
export const addClientNoteSchema = z.object({
  clientId: z.string().uuid(),
  body: noteBodyField,
});
export const clientNoteIdSchema = z.object({
  clientId: z.string().uuid(),
  noteId: z.string().uuid(),
});
