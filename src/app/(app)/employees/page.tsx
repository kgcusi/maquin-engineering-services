import { Suspense } from "react";
import type { Metadata } from "next";

import { TableSkeleton } from "@/components/app-shell/page-skeletons";
import { EmployeesTable } from "@/components/employees/employees-table";
import { requirePagePermission } from "@/lib/page-guards";
import {
  listEmployeeNames,
  listEmployeePositions,
  listEmployees,
} from "@/modules/employees/queries";
import { getSettings } from "@/modules/settings/queries";
import { directoryListSchema } from "@/modules/shared/list-params";

export const metadata: Metadata = { title: "Employees" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function EmployeesPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePagePermission("employee.view");

  return (
    <div className="w-full space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Employees</h1>
        <p className="text-muted-foreground text-sm">
          The workforce directory — people referenced in reports and receipts, and the base for HR.
        </p>
      </header>

      <Suspense fallback={<TableSkeleton columns={6} toolbar />}>
        <EmployeesSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function EmployeesSection({ searchParams }: { searchParams: SearchParams }) {
  const params = directoryListSchema.parse(await searchParams);
  const [result, positions, existingNames, settings] = await Promise.all([
    listEmployees(params),
    listEmployeePositions(),
    listEmployeeNames(),
    getSettings(),
  ]);

  return (
    <EmployeesTable
      rows={result.rows}
      total={result.total}
      page={result.page}
      pageSize={result.pageSize}
      positions={positions}
      existingNames={existingNames}
      timeZone={settings.timezone}
      currency={settings.currency}
    />
  );
}
