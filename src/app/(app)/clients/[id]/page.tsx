import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClientDetail } from "@/components/clients/client-detail";
import { requirePagePermission } from "@/lib/page-guards";
import { getClientById, getClientDocuments, getClientNotes } from "@/modules/clients/queries";
import { getSettings } from "@/modules/settings/queries";

export const metadata: Metadata = { title: "Client" };

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("client.view");
  const { id } = await params;

  const client = await getClientById(id);
  if (!client) notFound();

  const [documents, notes, settings] = await Promise.all([
    getClientDocuments(id),
    getClientNotes(id),
    getSettings(),
  ]);

  return (
    <ClientDetail
      client={client}
      documents={documents}
      notes={notes}
      timeZone={settings.timezone}
    />
  );
}
