import { z } from "zod";

import { EMPLOYMENT_TYPE_CODES, RATE_UNIT_CODES } from "@/lib/lookups";
import {
  entityDocumentSchemas,
  entityName,
  optionalAddress,
  optionalEmail,
  optionalNotes,
  optionalPhone,
  optionalText,
} from "@/modules/shared/contact-schema";

const optionalDate = z
  .union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date")])
  .optional();
// Up to 12 integer digits + 2 decimals — matches DECIMAL(14,2).
const optionalRate = z
  .union([z.literal(""), z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, "Enter a valid amount")])
  .optional();

export const createEmployeeSchema = z.object({
  fullName: entityName,
  position: optionalText(120),
  employmentType: z.union([z.literal(""), z.enum(EMPLOYMENT_TYPE_CODES)]).optional(),
  dateHired: optionalDate,
  phone: optionalPhone,
  email: optionalEmail,
  address: optionalAddress,
  rate: optionalRate,
  rateUnit: z.enum(RATE_UNIT_CODES),
  notes: optionalNotes,
});

export const updateEmployeeSchema = createEmployeeSchema.extend({ id: z.string().uuid() });
export const employeeIdSchema = z.object({ id: z.string().uuid() });

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

// ── Employee documents (typed, via the file pipeline) + notes ──────────────────
const employeeDocs = entityDocumentSchemas("employeeId");
export const presignEmployeeDocumentSchema = employeeDocs.presign;
export const confirmEmployeeDocumentSchema = employeeDocs.confirm;
export const employeeDocumentIdSchema = employeeDocs.docId;
export const addEmployeeNoteSchema = employeeDocs.addNote;
export const employeeNoteIdSchema = employeeDocs.noteId;
