"use client";

import { useState } from "react";
import { ListChecks, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";

import { ChecklistFormDialog } from "@/components/checklists/checklist-form-dialog";
import { DeleteConfirm } from "@/components/directory/delete-confirm";
import { DirectoryEmptyState } from "@/components/directory/empty-state";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteChecklistAction } from "@/modules/projects/inspections/checklists/actions";
import type { ChecklistTree } from "@/modules/projects/inspections/checklists/queries";

export function ChecklistsManager({
  checklists,
  canManage,
}: {
  checklists: ChecklistTree[];
  canManage: boolean;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ChecklistTree | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChecklistTree | null>(null);

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(checklist: ChecklistTree) {
    setEditing(checklist);
    setFormOpen(true);
  }

  return (
    <div className="space-y-4">
      {canManage ? (
        <div className="flex justify-end">
          <Button onClick={openNew}>
            <Plus className="size-4" /> New checklist
          </Button>
        </div>
      ) : null}

      {checklists.length === 0 ? (
        <DirectoryEmptyState
          icon={<ListChecks className="size-5" />}
          title="No checklists yet"
          description={
            canManage
              ? "Create a checklist so QA/QC engineers can run a consistent set of items at inspection time."
              : "An admin hasn't published any inspection checklists yet."
          }
          action={
            canManage ? (
              <Button onClick={openNew}>
                <Plus className="size-4" /> New checklist
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {checklists.map((checklist) => (
            <ChecklistCard
              key={checklist.id}
              checklist={checklist}
              canManage={canManage}
              onEdit={() => openEdit(checklist)}
              onDelete={() => setDeleteTarget(checklist)}
            />
          ))}
        </div>
      )}

      {canManage ? (
        <ChecklistFormDialog open={formOpen} onOpenChange={setFormOpen} checklist={editing} />
      ) : null}

      <DeleteConfirm
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        id={deleteTarget?.id ?? null}
        name={deleteTarget?.name ?? null}
        noun="checklist"
        deleteAction={deleteChecklistAction}
      />
    </div>
  );
}

function ChecklistCard({
  checklist,
  canManage,
  onEdit,
  onDelete,
}: {
  checklist: ChecklistTree;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const itemCount = checklist.items.length;
  return (
    <div className="bg-card flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-medium">{checklist.name}</h3>
            {!checklist.isActive ? (
              <span className="text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase">
                Inactive
              </span>
            ) : null}
          </div>
          {checklist.category ? (
            <span className="text-primary/80 bg-primary/10 inline-block rounded-md px-1.5 py-0.5 text-xs font-medium">
              {checklist.category}
            </span>
          ) : null}
        </div>
        {canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label={`Manage ${checklist.name}`} />
              }
            >
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {checklist.description ? (
        <p className="text-muted-foreground line-clamp-2 text-sm">{checklist.description}</p>
      ) : null}

      <div className="text-muted-foreground mt-auto flex items-center gap-1.5 text-xs">
        <ListChecks className="size-3.5" />
        {itemCount} {itemCount === 1 ? "item" : "items"}
      </div>
    </div>
  );
}
