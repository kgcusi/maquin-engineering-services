import { z } from "zod";

import { documentNameField, uploadFileFields } from "@/modules/files/schema";
import { noteBodyField } from "@/modules/notes/schema";

// Shared field validators for the directory CRUD modules (clients, suppliers,
// employees). Each is composed by both the form's zodResolver and the Server
// Action guard. Optional text fields accept "" (the form's empty value); the
// action normalizes "" → null before insert (see `orNull` in lib/action-helpers).

export const entityName = z.string().trim().min(1, "Name is required").max(160, "Name is too long");

// Optional, case-insensitive email: blank stays blank; a value is trimmed and
// lower-cased before the format check, so "Foo@Bar.com " is stored as
// "foo@bar.com". Mirrors the required `emailField` in the users module.
export const optionalEmail = z
  .union([z.literal(""), z.string().trim().toLowerCase().email("Enter a valid email")])
  .optional();

export const optionalPhone = z.string().trim().max(40).optional();
export const optionalAddress = z.string().trim().max(300).optional();
export const optionalNotes = z.string().trim().max(2000).optional();

// Generic bounded optional string (contact person, position, TIN, payment terms…).
export const optionalText = (max: number) => z.string().trim().max(max).optional();

// The document + note schemas are identical across modules apart from the parent
// id key (clientId / supplierId / employeeId). One factory keeps them in lockstep;
// the literal key is preserved in the inferred input type (e.g. `input.clientId`).
export function entityDocumentSchemas<K extends string>(idKey: K) {
  const idField = { [idKey]: z.string().uuid() } as { [P in K]: z.ZodString };
  return {
    presign: z.object({ ...idField, ...uploadFileFields }),
    confirm: z.object({ ...idField, fileId: z.string().uuid(), ...documentNameField }),
    docId: z.object({ ...idField, attachmentId: z.string().uuid() }),
    addNote: z.object({ ...idField, body: noteBodyField }),
    noteId: z.object({ ...idField, noteId: z.string().uuid() }),
  };
}
