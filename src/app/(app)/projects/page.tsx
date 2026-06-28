import { Suspense } from "react";
import type { Metadata } from "next";

import { TableSkeleton } from "@/components/app-shell/page-skeletons";
import { ProjectsTable } from "@/components/projects/projects-table";
import { requirePagePermission } from "@/lib/page-guards";
import { hasPermission } from "@/lib/rbac";
import {
  listClientOptions,
  listEngineerOptions,
  listProjects,
  type ProjectViewer,
} from "@/modules/projects/queries";
import { getActiveTemplatesWithTree } from "@/modules/projects/templates/queries";
import { getSettings } from "@/modules/settings/queries";
import { directoryListSchema } from "@/modules/shared/list-params";

export const metadata: Metadata = { title: "Projects" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ProjectsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requirePagePermission(["project.view.all", "project.view.assigned"]);
  const role = (session.user as { role?: string | null }).role ?? null;
  const viewer: ProjectViewer = { id: session.user.id, role };

  return (
    <div className="w-full space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Projects</h1>
        <p className="text-muted-foreground text-sm">
          {hasPermission(role, "project.view.all")
            ? "Every active site — its team, schedule, and progress. Open a project for documents, reports, and notes."
            : "Sites you're assigned to. Open a project for its schedule, documents, and daily reports."}
        </p>
      </header>

      <Suspense fallback={<TableSkeleton columns={7} toolbar />}>
        <ProjectsSection
          viewer={viewer}
          canCreate={hasPermission(role, "project.create")}
          canManage={hasPermission(role, "project.update")}
          searchParams={searchParams}
        />
      </Suspense>
    </div>
  );
}

async function ProjectsSection({
  viewer,
  canCreate,
  canManage,
  searchParams,
}: {
  viewer: ProjectViewer;
  canCreate: boolean;
  canManage: boolean;
  searchParams: SearchParams;
}) {
  const params = directoryListSchema.parse(await searchParams);
  const [result, settings, clients, engineers, templates] = await Promise.all([
    listProjects(viewer, params),
    getSettings(),
    canCreate ? listClientOptions() : Promise.resolve([]),
    canCreate ? listEngineerOptions() : Promise.resolve([]),
    canCreate ? getActiveTemplatesWithTree() : Promise.resolve([]),
  ]);

  return (
    <ProjectsTable
      rows={result.rows}
      total={result.total}
      page={result.page}
      pageSize={result.pageSize}
      canCreate={canCreate}
      canManage={canManage}
      clients={clients}
      engineers={engineers}
      templates={templates}
      timeZone={settings.timezone}
    />
  );
}
