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
import { cn } from "@/lib/utils";
import type { AttachmentRow } from "@/modules/files/service";
import type { NoteRow } from "@/modules/notes/service";
import type { Paginated } from "@/modules/shared/list-params";
import {
  addSupplierNoteAction,
  confirmSupplierDocumentAction,
  deleteSupplierDocumentAction,
  deleteSupplierNoteAction,
  getSupplierDocumentUrlAction,
  presignSupplierDocumentAction,
} from "@/modules/suppliers/actions";
import type { SupplierRow } from "@/modules/suppliers/queries";

import { SupplierFormDialog } from "./supplier-form-dialog";

type Tab = "info" | "documents" | "notes";

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

export function SupplierDetail({
  supplier,
  documents,
  notes,
  timeZone,
}: {
  supplier: SupplierRow;
  documents: Paginated<AttachmentRow>;
  notes: Paginated<NoteRow>;
  timeZone: string;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("info");
  const id = supplier.id;

  const tabs: { key: Tab; label: string }[] = [
    { key: "info", label: "Info" },
    { key: "documents", label: `Documents${documents.total ? ` (${documents.total})` : ""}` },
    { key: "notes", label: `Notes${notes.total ? ` (${notes.total})` : ""}` },
  ];

  return (
    <div className="w-full space-y-6">
      <div>
        <Link
          href={"/suppliers" as Route}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> Suppliers
        </Link>
      </div>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight">{supplier.name}</h1>
            <DirectoryStatusBadge
              deleted={supplier.deletedAt !== null}
              isActive={supplier.isActive}
            />
          </div>
          {supplier.contactPerson ? (
            <p className="text-muted-foreground text-sm">{supplier.contactPerson}</p>
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
          <Field label="Contact person" value={supplier.contactPerson} />
          <Field label="Phone" value={supplier.phone} />
          <Field label="Email" value={supplier.email} />
          <Field label="TIN" value={supplier.tin} />
          <Field label="Payment terms" value={supplier.paymentTerms} />
          <Field label="Address" value={supplier.address} />
          <div className="sm:col-span-2">
            <Field label="Remarks" value={supplier.notes} />
          </div>
        </dl>
      ) : null}

      {tab === "documents" ? (
        <div className="max-w-2xl space-y-4">
          <FileUploader
            onRequestUrl={(meta) => presignSupplierDocumentAction({ supplierId: id, ...meta })}
            onConfirm={(fileId, name) =>
              confirmSupplierDocumentAction({ supplierId: id, fileId, name })
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
              getSupplierDocumentUrlAction({ supplierId: id, attachmentId })
            }
            onDelete={(attachmentId) =>
              deleteSupplierDocumentAction({ supplierId: id, attachmentId })
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
            onAdd={(body) => addSupplierNoteAction({ supplierId: id, body })}
            onDelete={(noteId) => deleteSupplierNoteAction({ supplierId: id, noteId })}
          />
        </div>
      ) : null}

      <SupplierFormDialog open={editOpen} supplier={supplier} onOpenChange={setEditOpen} />
    </div>
  );
}
