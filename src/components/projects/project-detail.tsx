"use client";

import { useState } from "react";
import type { Route } from "next";
import { Link } from "react-transition-progress/next";
import { ArrowLeft, CalendarClock, Pencil, ShieldCheck } from "lucide-react";

import { ProjectDsrList } from "@/components/projects/project-dsr-list";
import { ProjectInspectionList } from "@/components/projects/project-inspection-list";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { ProjectOverview } from "@/components/projects/overview/project-overview";
import { ProjectTasks } from "@/components/projects/project-tasks";
import { AttachmentList } from "@/components/files/attachment-list";
import { FileUploader } from "@/components/files/file-uploader";
import { NotesPanel } from "@/components/notes/notes-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type { DsrListRow, DsrStatusCounts } from "@/modules/projects/dsr/queries";
import type {
  InspectionListRow,
  InspectionStatusCounts,
} from "@/modules/projects/inspections/queries";
import type { PhaseWithTasks } from "@/modules/projects/tasks/queries";
import type { TemplateTree } from "@/modules/projects/templates/queries";
import type { AttachmentRow } from "@/modules/files/service";
import type { NoteRow } from "@/modules/notes/service";
import type { Paginated } from "@/modules/shared/list-params";

type Tab = "overview" | "phases" | "reports" | "inspections" | "documents" | "notes";

const TABS: Tab[] = ["overview", "phases", "reports", "inspections", "documents", "notes"];
const isTab = (value: string | undefined): value is Tab => TABS.includes(value as Tab);

export function ProjectDetail({
  project,
  documents,
  notes,
  reports,
  timeZone,
  currency,
  canManage,
  canCreateDsr,
  clients,
  engineers,
  phases,
  assignees,
  canManageTasks,
  templates,
  inspections,
  inspectors,
  canViewInspections,
  canRequestInspection,
  canRecordInspection,
  canRecordAnyInspection,
  viewerId,
  initialTab,
  dsrSummary,
  inspectionSummary,
}: {
  project: ProjectDetailType;
  documents: Paginated<AttachmentRow>;
  notes: Paginated<NoteRow>;
  reports: Paginated<DsrListRow>;
  timeZone: string;
  currency: string;
  canManage: boolean;
  canCreateDsr: boolean;
  clients: { id: string; name: string }[];
  engineers: { id: string; name: string }[];
  phases: PhaseWithTasks[];
  assignees: { id: string; name: string }[];
  canManageTasks: boolean;
  templates: TemplateTree[];
  inspections: Paginated<InspectionListRow>;
  inspectors: { id: string; name: string }[];
  canViewInspections: boolean;
  canRequestInspection: boolean;
  canRecordInspection: boolean;
  canRecordAnyInspection: boolean;
  viewerId: string;
  initialTab?: string;
  dsrSummary: DsrStatusCounts;
  inspectionSummary: InspectionStatusCounts;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [tab, setTab] = useState<Tab>(isTab(initialTab) ? initialTab : "overview");
  const id = project.id;
  const status = project.status as ProjectStatus;
  const warranty = isInWarranty(status, parseDefects(project.defectsLiabilityUntil), new Date());

  const phaseCount = phases.length;
  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "phases", label: `Phases & Tasks${phaseCount ? ` (${phaseCount})` : ""}` },
    { key: "reports", label: `Daily Reports${reports.total ? ` (${reports.total})` : ""}` },
    ...(canViewInspections
      ? [
          {
            key: "inspections" as Tab,
            label: `Inspections${inspections.total ? ` (${inspections.total})` : ""}`,
          },
        ]
      : []),
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

      <div className="flex flex-wrap gap-1 border-b">
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
        <ProjectOverview
          project={project}
          phases={phases}
          currency={currency}
          timeZone={timeZone}
          canManage={canManage}
          dsrSummary={dsrSummary}
          inspectionSummary={inspectionSummary}
          canViewInspections={canViewInspections}
          onOpenPhases={() => setTab("phases")}
        />
      ) : null}

      {tab === "phases" ? (
        <ProjectTasks
          projectId={id}
          phases={phases}
          assignees={assignees}
          canManage={canManageTasks}
          viewerId={viewerId}
          timeZone={timeZone}
          templates={templates}
        />
      ) : null}

      {tab === "reports" ? (
        <ProjectDsrList
          projectId={id}
          reports={reports}
          timeZone={timeZone}
          canCreate={canCreateDsr}
        />
      ) : null}

      {tab === "inspections" && canViewInspections ? (
        <ProjectInspectionList
          projectId={id}
          inspections={inspections}
          timeZone={timeZone}
          canRequest={canRequestInspection}
          canRecord={canRecordInspection}
          canRecordAny={canRecordAnyInspection}
          viewerId={viewerId}
          inspectors={inspectors}
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
