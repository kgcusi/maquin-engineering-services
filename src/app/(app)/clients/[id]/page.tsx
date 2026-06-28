import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClientDetail } from "@/components/clients/client-detail";
import { requirePagePermission } from "@/lib/page-guards";
import { getClientById, getClientDocuments, getClientNotes } from "@/modules/clients/queries";
import { listClientProjects } from "@/modules/projects/queries";
import { getSettings } from "@/modules/settings/queries";
import { pageParam } from "@/modules/shared/list-params";

export const metadata: Metadata = { title: "Client" };

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePagePermission("client.view");
  const { id } = await params;
  const sp = await searchParams;
  const docsPage = pageParam(sp.docsPage);
  const notesPage = pageParam(sp.notesPage);

  const [client, documents, notes, projects, settings] = await Promise.all([
    getClientById(id),
    getClientDocuments(id, docsPage),
    getClientNotes(id, notesPage),
    listClientProjects(id),
    getSettings(),
  ]);
  if (!client) notFound();

  return (
    <ClientDetail
      client={client}
      documents={documents}
      notes={notes}
      projects={projects}
      timeZone={settings.timezone}
    />
  );
}
