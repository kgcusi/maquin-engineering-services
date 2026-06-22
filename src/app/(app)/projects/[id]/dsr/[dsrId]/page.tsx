import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Route } from "next";
import { Link } from "react-transition-progress/next";
import { ArrowLeft } from "lucide-react";

import { DsrEditor } from "@/components/projects/dsr/dsr-editor";
import { DsrStatusBadge } from "@/components/projects/dsr-status-badge";
import { requirePagePermission } from "@/lib/page-guards";
import { formatDateTime } from "@/lib/datetime";
import { hasPermission } from "@/lib/rbac";
import { getDsrEditor, getDsrPhotos } from "@/modules/projects/dsr/queries";
import type { ProjectViewer } from "@/modules/projects/queries";
import { getSettings } from "@/modules/settings/queries";
import { pageParam } from "@/modules/shared/list-params";

export const metadata: Metadata = { title: "Daily Report" };

export default async function DsrEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; dsrId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePagePermission("dsr.view");
  const role = (session.user as { role?: string | null }).role ?? null;
  const viewer: ProjectViewer = { id: session.user.id, role };

  const { id, dsrId } = await params;
  const sp = await searchParams;
  const photoPage = pageParam(sp.photoPage);

  const [dsr, photos, settings] = await Promise.all([
    getDsrEditor(viewer, dsrId),
    getDsrPhotos(dsrId, photoPage),
    getSettings(),
  ]);
  if (!dsr) notFound();

  const isAdmin = hasPermission(role, "dsr.view.all");
  const canEdit = dsr.status === "DRAFT" && (viewer.id === dsr.createdBy || isAdmin);
  const canReopen = dsr.status === "SUBMITTED" && isAdmin;

  const reportDate = formatDateTime(`${dsr.reportDate}T00:00:00`, settings.timezone, "date");

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <Link
          href={`/projects/${id}?tab=reports` as Route}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" />
          {dsr.projectName ?? "Project"}
        </Link>
      </div>

      <header className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-xl font-semibold tracking-tight tabular-nums">{reportDate}</h1>
          <DsrStatusBadge status={dsr.status} />
        </div>
        <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
          <span>Daily site report</span>
          <span aria-hidden>·</span>
          <span className="font-mono text-xs tracking-tight">{dsr.refCode}</span>
          {dsr.status === "SUBMITTED" && dsr.submittedByName ? (
            <>
              <span aria-hidden>·</span>
              <span>
                Filed by {dsr.submittedByName}
                {dsr.submittedAt
                  ? ` · ${formatDateTime(dsr.submittedAt, settings.timezone, "datetime")}`
                  : ""}
              </span>
            </>
          ) : null}
        </p>
      </header>

      <DsrEditor
        dsr={dsr}
        photos={photos}
        timeZone={settings.timezone}
        canEdit={canEdit}
        canReopen={canReopen}
      />
    </div>
  );
}
