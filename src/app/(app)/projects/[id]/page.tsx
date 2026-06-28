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
import { getProjectDsrStatusCounts, listProjectDsrs } from "@/modules/projects/dsr/queries";
import {
  getProjectInspectionStatusCounts,
  listProjectInspections,
  listQaQcEngineerOptions,
} from "@/modules/projects/inspections/queries";
import { listPhasesWithTasks, listProjectAssigneeOptions } from "@/modules/projects/tasks/queries";
import { getActiveTemplatesWithTree } from "@/modules/projects/templates/queries";
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
  const canViewInspections = hasPermission(role, "inspection.view");
  const canRequestInspection = hasPermission(role, "inspection.request");
  const canRecordInspection = hasPermission(role, "inspection.record");
  const canRecordAnyInspection = hasPermission(role, "project.view.all");

  const { id } = await params;
  const sp = await searchParams;
  const docsPage = pageParam(sp.docsPage);
  const notesPage = pageParam(sp.notesPage);
  const dsrPage = pageParam(sp.dsrPage);
  const inspPage = pageParam(sp.inspPage);
  const initialTab = typeof sp.tab === "string" ? sp.tab : undefined;

  // Resolve access FIRST (settings is firm-wide, safe to parallelize); only then
  // run the project-scoped child queries — a forbidden id 404s before they fire.
  const [project, settings] = await Promise.all([getProjectDetail(viewer, id), getSettings()]);
  if (!project) notFound();

  const [
    documents,
    notes,
    reports,
    inspections,
    clients,
    engineers,
    phases,
    assignees,
    inspectors,
    templates,
    dsrSummary,
    inspectionSummary,
  ] = await Promise.all([
    getProjectDocuments(id, docsPage),
    getProjectNotes(id, notesPage),
    listProjectDsrs(id, { page: dsrPage }),
    canViewInspections
      ? listProjectInspections(id, { page: inspPage })
      : Promise.resolve({ rows: [], total: 0, page: 1, pageSize: 25 }),
    canManage ? listClientOptions() : Promise.resolve([]),
    canManage ? listEngineerOptions() : Promise.resolve([]),
    listPhasesWithTasks(id),
    listProjectAssigneeOptions(id),
    canRequestInspection ? listQaQcEngineerOptions() : Promise.resolve([]),
    canManageTasks ? getActiveTemplatesWithTree() : Promise.resolve([]),
    getProjectDsrStatusCounts(id),
    canViewInspections
      ? getProjectInspectionStatusCounts(id)
      : Promise.resolve({ requested: 0, passed: 0, failed: 0, total: 0 }),
  ]);

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
      templates={templates}
      inspections={inspections}
      inspectors={inspectors}
      canViewInspections={canViewInspections}
      canRequestInspection={canRequestInspection}
      canRecordInspection={canRecordInspection}
      canRecordAnyInspection={canRecordAnyInspection}
      viewerId={viewer.id}
      initialTab={initialTab}
      dsrSummary={dsrSummary}
      inspectionSummary={inspectionSummary}
    />
  );
}
