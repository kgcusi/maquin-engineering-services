import type { Metadata } from "next";

import { SuppliersTable } from "@/components/suppliers/suppliers-table";
import { requirePagePermission } from "@/lib/page-guards";
import { getSettings } from "@/modules/settings/queries";
import { listSuppliers } from "@/modules/suppliers/queries";

export const metadata: Metadata = { title: "Suppliers" };

export default async function SuppliersPage() {
  await requirePagePermission("supplier.view");
  const [suppliers, settings] = await Promise.all([listSuppliers(), getSettings()]);

  return (
    <div className="w-full space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Suppliers</h1>
        <p className="text-muted-foreground text-sm">
          Vendors used across stock-in and expenses. Archived suppliers stay linked to past records.
        </p>
      </header>

      <SuppliersTable suppliers={suppliers} timeZone={settings.timezone} />
    </div>
  );
}
