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

export const createSupplierSchema = z.object({
  name: entityName,
  contactPerson: optionalText(160),
  phone: optionalPhone,
  email: optionalEmail,
  address: optionalAddress,
  tin: optionalText(40),
  paymentTerms: optionalText(120),
  // New records default to active; imports (no column) inherit the default too.
  isActive: z.boolean().default(true),
  notes: optionalNotes,
});

export const updateSupplierSchema = createSupplierSchema.extend({ id: z.string().uuid() });
export const supplierIdSchema = z.object({ id: z.string().uuid() });

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
// Form-side (resolver INPUT) type: `isActive` is optional here because of its
// `.default(true)`, so the form generic stays in sync with zodResolver.
export type CreateSupplierFormValues = z.input<typeof createSupplierSchema>;

// ── Supplier documents (file pipeline) + notes — supplierId scopes every op ─────
const supplierDocs = entityDocumentSchemas("supplierId");
export const presignSupplierDocumentSchema = supplierDocs.presign;
export const confirmSupplierDocumentSchema = supplierDocs.confirm;
export const supplierDocumentIdSchema = supplierDocs.docId;
export const addSupplierNoteSchema = supplierDocs.addNote;
export const supplierNoteIdSchema = supplierDocs.noteId;
