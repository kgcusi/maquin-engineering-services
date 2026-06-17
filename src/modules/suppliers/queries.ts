import { desc, isNull } from "drizzle-orm";

import { db } from "@/db/client";
import { suppliers } from "@/db/schema/suppliers";

export type SupplierRow = {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  tin: string | null;
  paymentTerms: string | null;
  notes: string | null;
  deletedAt: Date | null;
  createdAt: Date;
};

// Active suppliers only (soft-deleted are hidden). Newest first.
export async function listSuppliers(): Promise<SupplierRow[]> {
  return db
    .select({
      id: suppliers.id,
      name: suppliers.name,
      contactPerson: suppliers.contactPerson,
      phone: suppliers.phone,
      email: suppliers.email,
      address: suppliers.address,
      tin: suppliers.tin,
      paymentTerms: suppliers.paymentTerms,
      notes: suppliers.notes,
      deletedAt: suppliers.deletedAt,
      createdAt: suppliers.createdAt,
    })
    .from(suppliers)
    .where(isNull(suppliers.deletedAt))
    .orderBy(desc(suppliers.createdAt));
}
