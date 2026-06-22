import { z } from "zod";

import {
  entityDocumentSchemas,
  entityName,
  optionalAddress,
  optionalEmail,
  optionalNotes,
  optionalPhone,
  optionalText,
} from "@/modules/shared/contact-schema";

export const createClientSchema = z.object({
  name: entityName,
  contactPerson: optionalText(160),
  phone: optionalPhone,
  email: optionalEmail,
  address: optionalAddress,
  // New records default to active; imports (no column) inherit the default too.
  isActive: z.boolean().default(true),
  notes: optionalNotes,
});

export const updateClientSchema = createClientSchema.extend({ id: z.string().uuid() });
export const clientIdSchema = z.object({ id: z.string().uuid() });

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
// Form-side (resolver INPUT) type: `isActive` is optional here because of its
// `.default(true)`, so the form generic stays in sync with zodResolver.
export type CreateClientFormValues = z.input<typeof createClientSchema>;

// ── Client documents (file pipeline) + notes — clientId scopes every op ────────
const clientDocs = entityDocumentSchemas("clientId");
export const presignClientDocumentSchema = clientDocs.presign;
export const confirmClientDocumentSchema = clientDocs.confirm;
export const clientDocumentIdSchema = clientDocs.docId;
export const addClientNoteSchema = clientDocs.addNote;
export const clientNoteIdSchema = clientDocs.noteId;
