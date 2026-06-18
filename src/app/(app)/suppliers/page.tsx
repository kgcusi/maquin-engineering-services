import { Suspense } from "react";
import type { Metadata } from "next";

import { TableSkeleton } from "@/components/app-shell/page-skeletons";
import { SuppliersTable } from "@/components/suppliers/suppliers-table";
import { requirePagePermission } from "@/lib/page-guards";
import { getSettings } from "@/modules/settings/queries";
import { directoryListSchema } from "@/modules/shared/list-params";
import { listSupplierNames, listSuppliers } from "@/modules/suppliers/queries";

export const metadata: Metadata = { title: "Suppliers" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SuppliersPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePagePermission("supplier.view");

  return (
    <div className="w-full space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Suppliers</h1>
        <p className="text-muted-foreground text-sm">
          Vendors used across stock-in and expenses. Archived suppliers stay linked to past records.
        </p>
      </header>

      <Suspense fallback={<TableSkeleton columns={6} toolbar />}>
        <SuppliersSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SuppliersSection({ searchParams }: { searchParams: SearchParams }) {
  const params = directoryListSchema.parse(await searchParams);
  const [result, existingNames, settings] = await Promise.all([
    listSuppliers(params),
    listSupplierNames(),
    getSettings(),
  ]);

  return (
    <SuppliersTable
      rows={result.rows}
      total={result.total}
      page={result.page}
      pageSize={result.pageSize}
      existingNames={existingNames}
      timeZone={settings.timezone}
    />
  );
}
