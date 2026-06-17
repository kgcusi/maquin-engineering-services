import { z } from "zod";

import { EMPLOYEE_DOCUMENT_KINDS, EMPLOYMENT_TYPE_CODES, RATE_UNIT_CODES } from "@/lib/lookups";
import { uploadFileFields } from "@/modules/files/schema";
import { noteBodyField } from "@/modules/notes/schema";

// Shared by the client form (zodResolver) and the Server Action guard. Optional
// text fields accept "" (the form's empty value); the action normalizes "" → null.
const fullName = z.string().trim().min(1, "Name is required").max(160, "Name is too long");
const optionalEmail = z.union([z.literal(""), z.string().email("Enter a valid email")]).optional();
const optionalDate = z
  .union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date")])
  .optional();
// Up to 12 integer digits + 2 decimals — matches DECIMAL(14,2).
const optionalRate = z
  .union([z.literal(""), z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, "Enter a valid amount")])
  .optional();

export const createEmployeeSchema = z.object({
  fullName,
  position: z.string().trim().max(120).optional(),
  employmentType: z.union([z.literal(""), z.enum(EMPLOYMENT_TYPE_CODES)]).optional(),
  dateHired: optionalDate,
  phone: z.string().trim().max(40).optional(),
  email: optionalEmail,
  address: z.string().trim().max(300).optional(),
  rate: optionalRate,
  rateUnit: z.enum(RATE_UNIT_CODES),
  notes: z.string().trim().max(2000).optional(),
});

export const updateEmployeeSchema = createEmployeeSchema.extend({ id: z.string().uuid() });
export const employeeIdSchema = z.object({ id: z.string().uuid() });

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

// ── Employee documents (typed, via the file pipeline) + notes ──────────────────
export const presignEmployeeDocumentSchema = z.object({
  employeeId: z.string().uuid(),
  ...uploadFileFields,
});
export const confirmEmployeeDocumentSchema = z.object({
  employeeId: z.string().uuid(),
  fileId: z.string().uuid(),
  kind: z.enum(EMPLOYEE_DOCUMENT_KINDS),
});
export const employeeDocumentIdSchema = z.object({
  employeeId: z.string().uuid(),
  attachmentId: z.string().uuid(),
});
export const addEmployeeNoteSchema = z.object({
  employeeId: z.string().uuid(),
  body: noteBodyField,
});
export const employeeNoteIdSchema = z.object({
  employeeId: z.string().uuid(),
  noteId: z.string().uuid(),
});
