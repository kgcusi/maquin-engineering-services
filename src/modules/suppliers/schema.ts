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
  notes: optionalNotes,
});

export const updateSupplierSchema = createSupplierSchema.extend({ id: z.string().uuid() });
export const supplierIdSchema = z.object({ id: z.string().uuid() });

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;

// ── Supplier documents (file pipeline) + notes — supplierId scopes every op ─────
const supplierDocs = entityDocumentSchemas("supplierId");
export const presignSupplierDocumentSchema = supplierDocs.presign;
export const confirmSupplierDocumentSchema = supplierDocs.confirm;
export const supplierDocumentIdSchema = supplierDocs.docId;
export const addSupplierNoteSchema = supplierDocs.addNote;
export const supplierNoteIdSchema = supplierDocs.noteId;
