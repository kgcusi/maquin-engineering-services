"use client";

import { useState } from "react";
import {
  LayoutTemplate,
  Layers,
  ListChecks,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { DeleteConfirm } from "@/components/directory/delete-confirm";
import { DirectoryEmptyState } from "@/components/directory/empty-state";
import { TemplateFormDialog } from "@/components/templates/template-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteTemplateAction } from "@/modules/projects/templates/actions";
import type { TemplateTree } from "@/modules/projects/templates/queries";

type FormState = { mode: "create" } | { mode: "edit"; template: TemplateTree } | null;

function taskCount(tree: TemplateTree): number {
  return tree.phases.reduce((sum, p) => sum + p.tasks.length, 0);
}

export function TemplatesManager({
  templates,
  canManage,
}: {
  templates: TemplateTree[];
  canManage: boolean;
}) {
  const [form, setForm] = useState<FormState>(null);
  const [deleteTarget, setDeleteTarget] = useState<TemplateTree | null>(null);

  if (templates.length === 0) {
    return (
      <>
        <DirectoryEmptyState
          icon={<LayoutTemplate className="size-5" />}
          title="No templates yet"
          description={
            canManage
              ? "Author a template of phases and tasks once, then spin up a fully-scheduled project from it in seconds."
              : "When an admin authors a project template, it shows up here ready to use on new projects."
          }
          action={
            canManage ? (
              <Button onClick={() => setForm({ mode: "create" })}>
                <Plus />
                New template
              </Button>
            ) : undefined
          }
        />
        {canManage ? (
          <TemplateFormDialog
            open={form?.mode === "create"}
            template={null}
            onOpenChange={(open) => {
              if (!open) setForm(null);
            }}
          />
        ) : null}
      </>
    );
  }

  return (
    <div className="space-y-4">
      {canManage ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-muted-foreground text-sm tabular-nums">
            {templates.length} {templates.length === 1 ? "template" : "templates"}
          </p>
          <Button onClick={() => setForm({ mode: "create" })} className="shrink-0">
            <Plus />
            New template
          </Button>
        </div>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => {
          const phaseCount = template.phases.length;
          const tasks = taskCount(template);
          return (
            <li
              key={template.id}
              className="group bg-card hover:border-foreground/15 flex flex-col gap-3 rounded-xl border p-4 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <h2 className="truncate text-sm font-semibold tracking-tight">{template.name}</h2>
                  {template.isActive ? (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/30 dark:text-emerald-400"
                    >
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      Inactive
                    </Badge>
                  )}
                </div>
                {canManage ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Manage ${template.name}`}
                          className="-mt-1 -mr-1 shrink-0"
                        />
                      }
                    >
                      <MoreHorizontal />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setForm({ mode: "edit", template })}>
                        <Pencil />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeleteTarget(template)}
                      >
                        <Trash2 />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>

              <p className="text-muted-foreground line-clamp-2 min-h-8 text-xs">
                {template.description?.trim() ? (
                  template.description
                ) : (
                  <span className="italic">No description.</span>
                )}
              </p>

              <div className="text-muted-foreground mt-auto flex items-center gap-4 border-t pt-3 text-xs">
                <span className="flex items-center gap-1.5">
                  <Layers className="size-3.5 shrink-0" />
                  <span className="tabular-nums">{phaseCount}</span>{" "}
                  {phaseCount === 1 ? "phase" : "phases"}
                </span>
                <span className="flex items-center gap-1.5">
                  <ListChecks className="size-3.5 shrink-0" />
                  <span className="tabular-nums">{tasks}</span> {tasks === 1 ? "task" : "tasks"}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {canManage ? (
        <TemplateFormDialog
          open={form !== null}
          template={form?.mode === "edit" ? form.template : null}
          onOpenChange={(open) => {
            if (!open) setForm(null);
          }}
        />
      ) : null}

      <DeleteConfirm
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        id={deleteTarget?.id ?? null}
        name={deleteTarget?.name ?? null}
        noun="template"
        deleteAction={deleteTemplateAction}
      />
    </div>
  );
}
