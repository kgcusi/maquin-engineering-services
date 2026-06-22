import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProjectDetail } from "@/components/projects/project-detail";
import { requirePagePermission } from "@/lib/page-guards";
import { hasPermission } from "@/lib/rbac";
import {
  getProjectDetail,
  getProjectDocuments,
  getProjectNotes,
  listClientOptions,
  listEngineerOptions,
  type ProjectViewer,
} from "@/modules/projects/queries";
import { getSettings } from "@/modules/settings/queries";
import { pageParam } from "@/modules/shared/list-params";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePagePermission(["project.view.all", "project.view.assigned"]);
  const role = (session.user as { role?: string | null }).role ?? null;
  const viewer: ProjectViewer = { id: session.user.id, role };
  const canManage = hasPermission(role, "project.update");

  const { id } = await params;
  const sp = await searchParams;
  const docsPage = pageParam(sp.docsPage);
  const notesPage = pageParam(sp.notesPage);

  const [project, documents, notes, settings, clients, engineers] = await Promise.all([
    getProjectDetail(viewer, id),
    getProjectDocuments(id, docsPage),
    getProjectNotes(id, notesPage),
    getSettings(),
    canManage ? listClientOptions() : Promise.resolve([]),
    canManage ? listEngineerOptions() : Promise.resolve([]),
  ]);
  if (!project) notFound();

  return (
    <ProjectDetail
      project={project}
      documents={documents}
      notes={notes}
      timeZone={settings.timezone}
      currency={settings.currency}
      canManage={canManage}
      clients={clients}
      engineers={engineers}
    />
  );
}
