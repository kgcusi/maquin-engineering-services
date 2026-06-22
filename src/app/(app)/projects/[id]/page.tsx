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
import { listProjectDsrs } from "@/modules/projects/dsr/queries";
import { listPhasesWithTasks, listProjectAssigneeOptions } from "@/modules/projects/tasks/queries";
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
  const canManageTasks = hasPermission(role, "task.manage");
  const canCreateDsr = hasPermission(role, "dsr.create");

  const { id } = await params;
  const sp = await searchParams;
  const docsPage = pageParam(sp.docsPage);
  const notesPage = pageParam(sp.notesPage);
  const dsrPage = pageParam(sp.dsrPage);
  const initialTab = typeof sp.tab === "string" ? sp.tab : undefined;

  const [project, documents, notes, reports, settings, clients, engineers, phases, assignees] =
    await Promise.all([
      getProjectDetail(viewer, id),
      getProjectDocuments(id, docsPage),
      getProjectNotes(id, notesPage),
      listProjectDsrs(id, { page: dsrPage }),
      getSettings(),
      canManage ? listClientOptions() : Promise.resolve([]),
      canManage ? listEngineerOptions() : Promise.resolve([]),
      listPhasesWithTasks(id),
      listProjectAssigneeOptions(id),
    ]);
  if (!project) notFound();

  return (
    <ProjectDetail
      project={project}
      documents={documents}
      notes={notes}
      reports={reports}
      timeZone={settings.timezone}
      currency={settings.currency}
      canManage={canManage}
      canCreateDsr={canCreateDsr}
      clients={clients}
      engineers={engineers}
      phases={phases}
      assignees={assignees}
      canManageTasks={canManageTasks}
      viewerId={viewer.id}
      initialTab={initialTab}
    />
  );
}
