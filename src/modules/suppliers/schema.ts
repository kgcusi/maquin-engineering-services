import { z } from "zod";

// Shared by the client form (zodResolver) and the Server Action guard. Optional
// text fields accept "" (the form's empty value); the action normalizes "" → null.
const name = z.string().trim().min(1, "Name is required").max(160, "Name is too long");
const optionalEmail = z.union([z.literal(""), z.string().email("Enter a valid email")]).optional();

export const createSupplierSchema = z.object({
  name,
  contactPerson: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(40).optional(),
  email: optionalEmail,
  address: z.string().trim().max(300).optional(),
  tin: z.string().trim().max(40).optional(),
  paymentTerms: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const updateSupplierSchema = createSupplierSchema.extend({ id: z.string().uuid() });
export const supplierIdSchema = z.object({ id: z.string().uuid() });

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
