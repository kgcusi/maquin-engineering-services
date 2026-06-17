"use client";

import { useState } from "react";
import type { Route } from "next";
import { Link } from "react-transition-progress/next";
import { ArrowLeft, FolderKanban, Pencil } from "lucide-react";

import { DirectoryStatusBadge } from "@/components/directory/status-badge";
import { AttachmentList } from "@/components/files/attachment-list";
import { FileUploader } from "@/components/files/file-uploader";
import { NotesPanel } from "@/components/notes/notes-panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  addClientNoteAction,
  confirmClientDocumentAction,
  deleteClientDocumentAction,
  deleteClientNoteAction,
  getClientDocumentUrlAction,
  presignClientDocumentAction,
} from "@/modules/clients/actions";
import type { ClientRow } from "@/modules/clients/queries";
import type { AttachmentRow } from "@/modules/files/service";
import type { NoteRow } from "@/modules/notes/service";

import { ClientFormDialog } from "./client-form-dialog";

type Tab = "info" | "documents" | "notes" | "projects";

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

export function ClientDetail({
  client,
  documents,
  notes,
  timeZone,
}: {
  client: ClientRow;
  documents: AttachmentRow[];
  notes: NoteRow[];
  timeZone: string;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("info");
  const id = client.id;

  const tabs: { key: Tab; label: string }[] = [
    { key: "info", label: "Info" },
    { key: "documents", label: `Documents${documents.length ? ` (${documents.length})` : ""}` },
    { key: "notes", label: `Notes${notes.length ? ` (${notes.length})` : ""}` },
    { key: "projects", label: "Projects" },
  ];

  return (
    <div className="w-full space-y-6">
      <div>
        <Link
          href={"/clients" as Route}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> Clients
        </Link>
      </div>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight">{client.name}</h1>
            <DirectoryStatusBadge deleted={client.deletedAt !== null} />
          </div>
          {client.contactPerson ? (
            <p className="text-muted-foreground text-sm">{client.contactPerson}</p>
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
          <Field label="Contact person" value={client.contactPerson} />
          <Field label="Phone" value={client.phone} />
          <Field label="Email" value={client.email} />
          <Field label="Address" value={client.address} />
          <div className="sm:col-span-2">
            <Field label="Remarks" value={client.notes} />
          </div>
        </dl>
      ) : null}

      {tab === "documents" ? (
        <div className="max-w-2xl space-y-4">
          <FileUploader
            onRequestUrl={(meta) => presignClientDocumentAction({ clientId: id, ...meta })}
            onConfirm={(fileId) => confirmClientDocumentAction({ clientId: id, fileId })}
          />
          <AttachmentList
            documents={documents}
            timeZone={timeZone}
            onDownload={(attachmentId) =>
              getClientDocumentUrlAction({ clientId: id, attachmentId })
            }
            onDelete={(attachmentId) => deleteClientDocumentAction({ clientId: id, attachmentId })}
          />
        </div>
      ) : null}

      {tab === "notes" ? (
        <div className="max-w-2xl">
          <NotesPanel
            notes={notes}
            timeZone={timeZone}
            onAdd={(body) => addClientNoteAction({ clientId: id, body })}
            onDelete={(noteId) => deleteClientNoteAction({ clientId: id, noteId })}
          />
        </div>
      ) : null}

      {tab === "projects" ? (
        <div className="flex max-w-2xl flex-col items-center gap-3 rounded-lg border border-dashed py-14 text-center">
          <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full">
            <FolderKanban className="size-5" />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-medium">No project history yet</p>
            <p className="text-muted-foreground text-sm">
              Projects created for this client will appear here once the Projects module ships.
            </p>
          </div>
        </div>
      ) : null}

      <ClientFormDialog open={editOpen} client={client} onOpenChange={setEditOpen} />
    </div>
  );
}
