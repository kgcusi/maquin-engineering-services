"use client";

import { useState } from "react";
import type { Route } from "next";
import { Link } from "react-transition-progress/next";
import { ArrowLeft, CalendarClock, ClipboardList, Pencil, ShieldCheck } from "lucide-react";

import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { ProjectStatusBadge } from "@/components/projects/project-status-badge";
import { ProjectStatusControl } from "@/components/projects/project-status-control";
import { ProjectTasks } from "@/components/projects/project-tasks";
import { ProjectTeam } from "@/components/projects/project-team";
import { AttachmentList } from "@/components/files/attachment-list";
import { FileUploader } from "@/components/files/file-uploader";
import { NotesPanel } from "@/components/notes/notes-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";
import { isInWarranty, type ProjectStatus } from "@/lib/statuses";
import { cn } from "@/lib/utils";
import {
  addProjectNoteAction,
  confirmProjectDocumentAction,
  deleteProjectDocumentAction,
  deleteProjectNoteAction,
  getProjectDocumentUrlAction,
  presignProjectDocumentAction,
} from "@/modules/projects/actions";
import type { ProjectDetail as ProjectDetailType } from "@/modules/projects/queries";
import type { PhaseWithTasks } from "@/modules/projects/tasks/queries";
import type { AttachmentRow } from "@/modules/files/service";
import type { NoteRow } from "@/modules/notes/service";
import type { Paginated } from "@/modules/shared/list-params";

type Tab = "overview" | "phases" | "reports" | "documents" | "notes";

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(d);
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm">
        {value?.trim() ? value : <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  );
}

// Designed "this slice ships later" panel — no bare "Coming soon" string.
function SoonPanel({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof ClipboardList;
  title: string;
  description: string;
}) {
  return (
    <div className="flex max-w-2xl flex-col items-center gap-3 rounded-lg border border-dashed py-14 text-center">
      <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full">
        <Icon className="size-5" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-muted-foreground mx-auto max-w-sm text-sm">{description}</p>
      </div>
    </div>
  );
}

export function ProjectDetail({
  project,
  documents,
  notes,
  timeZone,
  currency,
  canManage,
  clients,
  engineers,
  phases,
  assignees,
  canManageTasks,
  viewerId,
}: {
  project: ProjectDetailType;
  documents: Paginated<AttachmentRow>;
  notes: Paginated<NoteRow>;
  timeZone: string;
  currency: string;
  canManage: boolean;
  clients: { id: string; name: string }[];
  engineers: { id: string; name: string }[];
  phases: PhaseWithTasks[];
  assignees: { id: string; name: string }[];
  canManageTasks: boolean;
  viewerId: string;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const id = project.id;
  const status = project.status as ProjectStatus;
  const warranty = isInWarranty(status, parseDefects(project.defectsLiabilityUntil), new Date());

  const contract = project.contractAmount ? formatCurrency(project.contractAmount, currency) : null;

  const phaseCount = phases.length;
  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "phases", label: `Phases & Tasks${phaseCount ? ` (${phaseCount})` : ""}` },
    { key: "reports", label: "Daily Reports" },
    { key: "documents", label: `Documents${documents.total ? ` (${documents.total})` : ""}` },
    { key: "notes", label: `Notes${notes.total ? ` (${notes.total})` : ""}` },
  ];

  return (
    <div className="w-full space-y-6">
      <div>
        <Link
          href={"/projects" as Route}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> Projects
        </Link>
      </div>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight">{project.name}</h1>
            {warranty ? (
              <Badge
                variant="outline"
                className="gap-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/30 dark:text-emerald-400"
              >
                <ShieldCheck className="size-3" /> In warranty
              </Badge>
            ) : null}
          </div>
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <span className="font-mono text-xs tracking-tight">{project.refCode}</span>
            {project.clientName ? (
              <>
                <span aria-hidden>·</span>
                <span>{project.clientName}</span>
              </>
            ) : null}
          </p>
        </div>
        {canManage ? (
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" /> Edit
          </Button>
        ) : null}
      </header>

      <div className="flex gap-1 overflow-x-auto border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === t.key
                ? "border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Status
              </h2>
              {canManage ? (
                <ProjectStatusControl projectId={id} status={status} />
              ) : (
                <ProjectStatusBadge status={status} />
              )}
            </div>

            <dl className="grid gap-5 sm:grid-cols-2">
              <Field label="Location" value={project.location} />
              <Field label="Contract amount" value={contract} />
              <Field label="Start date" value={formatDate(project.startDate)} />
              <Field label="Target end date" value={formatDate(project.targetEndDate)} />
              <Field label="Actual end date" value={formatDate(project.actualEndDate)} />
              <Field
                label="Defects liability until"
                value={formatDate(project.defectsLiabilityUntil)}
              />
              <div className="sm:col-span-2">
                <Field label="Scope of work" value={project.scopeOfWork} />
              </div>
            </dl>
          </div>

          <aside className="space-y-4 lg:border-l lg:pl-8">
            <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Team
            </h2>
            <ProjectTeam members={project.members} />
          </aside>
        </div>
      ) : null}

      {tab === "phases" ? (
        <ProjectTasks
          projectId={id}
          phases={phases}
          assignees={assignees}
          canManage={canManageTasks}
          viewerId={viewerId}
          timeZone={timeZone}
        />
      ) : null}

      {tab === "reports" ? (
        <SoonPanel
          icon={ClipboardList}
          title="Daily site reports are on the way"
          description="Field engineers will file daily reports — manpower, weather, and issues — from this tab soon."
        />
      ) : null}

      {tab === "documents" ? (
        <div className="max-w-2xl space-y-4">
          {canManage ? (
            <FileUploader
              onRequestUrl={(meta) => presignProjectDocumentAction({ projectId: id, ...meta })}
              onConfirm={(fileId, name) =>
                confirmProjectDocumentAction({ projectId: id, fileId, name })
              }
            />
          ) : (
            <p className="text-muted-foreground bg-muted/30 flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-xs">
              <CalendarClock className="size-4 shrink-0" />
              Documents are managed by the project admin. You can download anything filed here.
            </p>
          )}
          <AttachmentList
            documents={documents.rows}
            page={documents.page}
            total={documents.total}
            pageSize={documents.pageSize}
            paramKey="docsPage"
            timeZone={timeZone}
            onDownload={(attachmentId) =>
              getProjectDocumentUrlAction({ projectId: id, attachmentId })
            }
            onDelete={
              canManage
                ? (attachmentId) => deleteProjectDocumentAction({ projectId: id, attachmentId })
                : undefined
            }
          />
        </div>
      ) : null}

      {tab === "notes" ? (
        <div className="max-w-2xl">
          <NotesPanel
            notes={notes.rows}
            page={notes.page}
            total={notes.total}
            pageSize={notes.pageSize}
            paramKey="notesPage"
            timeZone={timeZone}
            onAdd={(body) => addProjectNoteAction({ projectId: id, body })}
            onDelete={(noteId) => deleteProjectNoteAction({ projectId: id, noteId })}
          />
        </div>
      ) : null}

      {canManage ? (
        <ProjectFormDialog
          open={editOpen}
          project={project}
          clients={clients}
          engineers={engineers}
          onOpenChange={setEditOpen}
        />
      ) : null}
    </div>
  );
}

// `defectsLiabilityUntil` arrives as a "YYYY-MM-DD" string; isInWarranty wants a
// Date. Parse at local midnight (avoids the UTC off-by-one of `new Date(str)`).
function parseDefects(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
