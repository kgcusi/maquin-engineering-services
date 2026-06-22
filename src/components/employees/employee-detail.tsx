"use client";

import { useState } from "react";
import type { Route } from "next";
import { Link } from "react-transition-progress/next";
import { ArrowLeft, Pencil } from "lucide-react";

import { DirectoryStatusBadge } from "@/components/directory/status-badge";
import { AttachmentList } from "@/components/files/attachment-list";
import { FileUploader } from "@/components/files/file-uploader";
import { NotesPanel } from "@/components/notes/notes-panel";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";
import { employmentTypeLabel, rateUnitLabel } from "@/lib/lookups";
import { cn } from "@/lib/utils";
import {
  addEmployeeNoteAction,
  confirmEmployeeDocumentAction,
  deleteEmployeeDocumentAction,
  deleteEmployeeNoteAction,
  getEmployeeDocumentUrlAction,
  presignEmployeeDocumentAction,
} from "@/modules/employees/actions";
import type { EmployeeRow } from "@/modules/employees/queries";
import type { AttachmentRow } from "@/modules/files/service";
import type { NoteRow } from "@/modules/notes/service";
import type { Paginated } from "@/modules/shared/list-params";

import { EmployeeFormDialog } from "./employee-form-dialog";

type Tab = "info" | "documents" | "notes";

function formatHireDate(iso: string | null): string | null {
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

export function EmployeeDetail({
  employee,
  documents,
  notes,
  positions,
  timeZone,
  currency,
}: {
  employee: EmployeeRow;
  documents: Paginated<AttachmentRow>;
  notes: Paginated<NoteRow>;
  positions: string[];
  timeZone: string;
  currency: string;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("info");
  const id = employee.id;

  const rateDisplay = employee.rate
    ? `${formatCurrency(employee.rate, currency)} · ${rateUnitLabel(employee.rateUnit)}`
    : null;

  const tabs: { key: Tab; label: string }[] = [
    { key: "info", label: "Info" },
    { key: "documents", label: `Documents${documents.total ? ` (${documents.total})` : ""}` },
    { key: "notes", label: `Notes${notes.total ? ` (${notes.total})` : ""}` },
  ];

  return (
    <div className="w-full space-y-6">
      <div>
        <Link
          href={"/employees" as Route}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> Employees
        </Link>
      </div>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight">{employee.fullName}</h1>
            <DirectoryStatusBadge
              deleted={employee.deletedAt !== null}
              isActive={employee.isActive}
            />
          </div>
          {employee.position ? (
            <p className="text-muted-foreground text-sm">{employee.position}</p>
          ) : null}
        </div>
        <Button variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil className="size-4" /> Edit
        </Button>
      </header>

      <div className="flex gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === t.key
                ? "border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "info" ? (
        <dl className="grid max-w-2xl gap-5 sm:grid-cols-2">
          <Field label="Position" value={employee.position} />
          <Field label="Employment type" value={employmentTypeLabel(employee.employmentType)} />
          <Field label="Date hired" value={formatHireDate(employee.dateHired)} />
          <Field label="Pay rate" value={rateDisplay} />
          <Field label="Phone" value={employee.phone} />
          <Field label="Email" value={employee.email} />
          <div className="sm:col-span-2">
            <Field label="Address" value={employee.address} />
          </div>
          <div className="sm:col-span-2">
            <Field label="Remarks" value={employee.notes} />
          </div>
        </dl>
      ) : null}

      {tab === "documents" ? (
        <div className="max-w-2xl space-y-4">
          <FileUploader
            onRequestUrl={(meta) => presignEmployeeDocumentAction({ employeeId: id, ...meta })}
            onConfirm={(fileId, name) =>
              confirmEmployeeDocumentAction({ employeeId: id, fileId, name })
            }
          />
          <AttachmentList
            documents={documents.rows}
            page={documents.page}
            total={documents.total}
            pageSize={documents.pageSize}
            paramKey="docsPage"
            timeZone={timeZone}
            onDownload={(attachmentId) =>
              getEmployeeDocumentUrlAction({ employeeId: id, attachmentId })
            }
            onDelete={(attachmentId) =>
              deleteEmployeeDocumentAction({ employeeId: id, attachmentId })
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
            onAdd={(body) => addEmployeeNoteAction({ employeeId: id, body })}
            onDelete={(noteId) => deleteEmployeeNoteAction({ employeeId: id, noteId })}
          />
        </div>
      ) : null}

      <EmployeeFormDialog
        open={editOpen}
        employee={employee}
        positions={positions}
        onOpenChange={setEditOpen}
      />
    </div>
  );
}
