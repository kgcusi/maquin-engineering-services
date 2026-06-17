import { Suspense } from "react";
import type { Metadata } from "next";

import { TableSkeleton } from "@/components/app-shell/page-skeletons";
import { EmployeesTable } from "@/components/employees/employees-table";
import { requirePagePermission } from "@/lib/page-guards";
import { listEmployeePositions, listEmployees } from "@/modules/employees/queries";
import { getSettings } from "@/modules/settings/queries";

export const metadata: Metadata = { title: "Employees" };

export default async function EmployeesPage() {
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
        <EmployeesSection />
      </Suspense>
    </div>
  );
}

async function EmployeesSection() {
  const [employees, positions, settings] = await Promise.all([
    listEmployees(),
    listEmployeePositions(),
    getSettings(),
  ]);

  return (
    <EmployeesTable
      employees={employees}
      positions={positions}
      timeZone={settings.timezone}
      currency={settings.currency}
    />
  );
}
