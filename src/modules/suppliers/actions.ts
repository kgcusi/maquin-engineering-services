"use server";

import { eq } from "drizzle-orm";

import { suppliers } from "@/db/schema/suppliers";
import { audit } from "@/lib/audit";
import { ActionError, action } from "@/lib/rbac";

import { createSupplierSchema, supplierIdSchema, updateSupplierSchema } from "./schema";

// "" (the form's empty value) → null, so optional columns stay NULL not blank.
const orNull = (v?: string | null) => (v && v.length ? v : null);

export const createSupplierAction = action(
  "supplier.manage",
  createSupplierSchema,
  async (input, { user: actor, tx }) => {
    const [created] = await tx
      .insert(suppliers)
      .values({
        name: input.name,
        contactPerson: orNull(input.contactPerson),
        phone: orNull(input.phone),
        email: orNull(input.email),
        address: orNull(input.address),
        tin: orNull(input.tin),
        paymentTerms: orNull(input.paymentTerms),
        notes: orNull(input.notes),
      })
      .returning({ id: suppliers.id });

    await audit(tx, {
      actorId: actor.id,
      action: "supplier.created",
      entityType: "supplier",
      entityId: created.id,
      summary: `Created supplier ${input.name}`,
      diff: { name: input.name, contactPerson: orNull(input.contactPerson) },
    });

    return { id: created.id };
  },
);

export const updateSupplierAction = action(
  "supplier.manage",
  updateSupplierSchema,
  async (input, { user: actor, tx }) => {
    const [target] = await tx
      .select({ id: suppliers.id, name: suppliers.name })
      .from(suppliers)
      .where(eq(suppliers.id, input.id))
      .limit(1);
    if (!target) throw new ActionError("Supplier not found.");

    await tx
      .update(suppliers)
      .set({
        name: input.name,
        contactPerson: orNull(input.contactPerson),
        phone: orNull(input.phone),
        email: orNull(input.email),
        address: orNull(input.address),
        tin: orNull(input.tin),
        paymentTerms: orNull(input.paymentTerms),
        notes: orNull(input.notes),
        updatedAt: new Date(),
      })
      .where(eq(suppliers.id, input.id));

    await audit(tx, {
      actorId: actor.id,
      action: "supplier.updated",
      entityType: "supplier",
      entityId: input.id,
      summary: `Updated supplier ${input.name}`,
      diff: { name: { from: target.name, to: input.name } },
    });

    return { id: input.id };
  },
);

// Soft delete (keeps the row for referential integrity once stock-in/expenses
// reference suppliers) — but it reads as a plain "Delete" in the UI; the record
// leaves the directory and lists hide it. No restore.
export const deleteSupplierAction = action(
  "supplier.manage",
  supplierIdSchema,
  async (input, { user: actor, tx }) => {
    const [target] = await tx
      .select({ id: suppliers.id, name: suppliers.name, deletedAt: suppliers.deletedAt })
      .from(suppliers)
      .where(eq(suppliers.id, input.id))
      .limit(1);
    if (!target) throw new ActionError("Supplier not found.");
    if (target.deletedAt) return { id: input.id };

    await tx.update(suppliers).set({ deletedAt: new Date() }).where(eq(suppliers.id, input.id));
    await audit(tx, {
      actorId: actor.id,
      action: "supplier.deleted",
      entityType: "supplier",
      entityId: input.id,
      summary: `Deleted supplier ${target.name}`,
    });

    return { id: input.id };
  },
);
