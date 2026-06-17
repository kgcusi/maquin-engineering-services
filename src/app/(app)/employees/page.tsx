import type { Metadata } from "next";

import { EmployeesTable } from "@/components/employees/employees-table";
import { requirePagePermission } from "@/lib/page-guards";
import { listEmployeePositions, listEmployees } from "@/modules/employees/queries";
import { getSettings } from "@/modules/settings/queries";

export const metadata: Metadata = { title: "Employees" };

export default async function EmployeesPage() {
  await requirePagePermission("employee.view");
  const [employees, positions, settings] = await Promise.all([
    listEmployees(),
    listEmployeePositions(),
    getSettings(),
  ]);

  return (
    <div className="w-full space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Employees</h1>
        <p className="text-muted-foreground text-sm">
          The workforce directory — people referenced in reports and receipts, and the base for HR.
        </p>
      </header>

      <EmployeesTable
        employees={employees}
        positions={positions}
        timeZone={settings.timezone}
        currency={settings.currency}
      />
    </div>
  );
}
