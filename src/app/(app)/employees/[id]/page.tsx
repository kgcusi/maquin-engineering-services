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
import { pageParam } from "@/modules/shared/list-params";

export const metadata: Metadata = { title: "Employee" };

export default async function EmployeeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePagePermission("employee.view");
  const { id } = await params;
  const sp = await searchParams;
  const docsPage = pageParam(sp.docsPage);
  const notesPage = pageParam(sp.notesPage);

  const [employee, documents, notes, positions, settings] = await Promise.all([
    getEmployeeById(id),
    getEmployeeDocuments(id, docsPage),
    getEmployeeNotes(id, notesPage),
    listEmployeePositions(),
    getSettings(),
  ]);
  if (!employee) notFound();

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
