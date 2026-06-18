import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SupplierDetail } from "@/components/suppliers/supplier-detail";
import { requirePagePermission } from "@/lib/page-guards";
import {
  getSupplierById,
  getSupplierDocuments,
  getSupplierNotes,
} from "@/modules/suppliers/queries";
import { getSettings } from "@/modules/settings/queries";
import { pageParam } from "@/modules/shared/list-params";

export const metadata: Metadata = { title: "Supplier" };

export default async function SupplierDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePagePermission("supplier.view");
  const { id } = await params;
  const sp = await searchParams;
  const docsPage = pageParam(sp.docsPage);
  const notesPage = pageParam(sp.notesPage);

  const [supplier, documents, notes, settings] = await Promise.all([
    getSupplierById(id),
    getSupplierDocuments(id, docsPage),
    getSupplierNotes(id, notesPage),
    getSettings(),
  ]);
  if (!supplier) notFound();

  return (
    <SupplierDetail
      supplier={supplier}
      documents={documents}
      notes={notes}
      timeZone={settings.timezone}
    />
  );
}
