import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EmployeeDetail } from "@/components/employees/employee-detail";
import { requirePagePermission } from "@/lib/page-guards";
import {
  getEmployeeById,
  getEmployeeDocuments,
  getEmployeeNotes,
  listEmployeePositions,
} from "@/modules/employees/queries";
import { getSettings } from "@/modules/settings/queries";

export const metadata: Metadata = { title: "Employee" };

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("employee.view");
  const { id } = await params;

  const employee = await getEmployeeById(id);
  if (!employee) notFound();

  const [documents, notes, positions, settings] = await Promise.all([
    getEmployeeDocuments(id),
    getEmployeeNotes(id),
    listEmployeePositions(),
    getSettings(),
  ]);

  return (
    <EmployeeDetail
      employee={employee}
      documents={documents}
      notes={notes}
      positions={positions}
      timeZone={settings.timezone}
      currency={settings.currency}
    />
  );
}
