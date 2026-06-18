import { eq } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

import type { Database } from "@/db/client";
import { ActionError } from "@/lib/rbac";

// "" (the form's empty value) → null, so optional columns stay NULL not blank.
// Shared by every directory CRUD action (clients, suppliers, employees…).
export const orNull = (v?: string | null) => (v && v.length ? v : null);

// Loads an entity's display name and throws a consistent "<Label> not found."
// when the id doesn't resolve. Used by the document/note sub-actions to scope an
// operation to a real parent row and label its audit summary. Each module binds
// this once with its table/columns (see `requireClientName` etc.).
export async function requireEntityRef(
  db: Database,
  opts: { label: string; table: PgTable; idColumn: PgColumn; nameColumn: PgColumn; id: string },
): Promise<string> {
  const [row] = await db
    .select({ name: opts.nameColumn })
    .from(opts.table)
    .where(eq(opts.idColumn, opts.id))
    .limit(1);
  if (!row) throw new ActionError(`${opts.label} not found.`);
  return row.name as string;
}
