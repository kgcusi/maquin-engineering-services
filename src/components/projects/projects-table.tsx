"use client";

import { useEffect, useRef, useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { Eye, FolderKanban, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Link } from "react-transition-progress/next";

import { DeleteConfirm } from "@/components/directory/delete-confirm";
import { DirectoryToolbar } from "@/components/directory/directory-toolbar";
import { DirectoryEmptyState } from "@/components/directory/empty-state";
import { TablePagination } from "@/components/directory/table-pagination";
import { useListQuery } from "@/components/directory/use-list-query";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { ProjectStatusBadge } from "@/components/projects/project-status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/datetime";
import { deleteProjectAction } from "@/modules/projects/actions";
import type { ProjectListRow } from "@/modules/projects/queries";

type Option = { id: string; name: string };

type TableMeta = {
  canManage: boolean;
  onEdit: (p: ProjectListRow) => void;
  onDelete: (p: ProjectListRow) => void;
  timeZone: string;
};

function ProgressMeter({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="flex items-center gap-2">
      <div className="bg-muted h-1.5 w-20 overflow-hidden rounded-full">
        <div
          className="bg-primary h-full rounded-full transition-[width]"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="text-muted-foreground w-9 text-right text-xs tabular-nums">{clamped}%</span>
    </div>
  );
}

const columns: ColumnDef<ProjectListRow>[] = [
  {
    accessorKey: "name",
    header: "Project",
    cell: ({ row }) => (
      <div className="flex flex-col">
        <Link
          href={`/projects/${row.original.id}` as Route}
          className="hover:text-primary font-medium underline-offset-4 hover:underline"
        >
          {row.original.name}
        </Link>
        <span className="text-muted-foreground font-mono text-xs tracking-tight">
          {row.original.refCode}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "clientName",
    header: "Client",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.clientName ?? "—"}</span>
    ),
  },
  {
    accessorKey: "leadName",
    header: "Lead",
    cell: ({ row }) =>
      row.original.leadName ? (
        <span>{row.original.leadName}</span>
      ) : (
        <span className="text-muted-foreground italic">Unassigned</span>
      ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <ProjectStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "progressPct",
    header: "Progress",
    cell: ({ row }) => <ProgressMeter pct={row.original.progressPct} />,
  },
  {
    accessorKey: "targetEndDate",
    header: "Target end",
    cell: ({ row, table }) =>
      row.original.targetEndDate ? (
        <span className="text-muted-foreground tabular-nums">
          {formatDateTime(
            row.original.targetEndDate,
            (table.options.meta as TableMeta).timeZone,
            "date",
          )}
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row, table }) => {
      const project = row.original;
      const meta = table.options.meta as TableMeta;
      return (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label={`Manage ${project.name}`} />
              }
            >
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem render={<Link href={`/projects/${project.id}` as Route} />}>
                <Eye />
                Open project
              </DropdownMenuItem>
              {meta.canManage ? (
                <>
                  <DropdownMenuItem onClick={() => meta.onEdit(project)}>
                    <Pencil />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={() => meta.onDelete(project)}>
                    <Trash2 />
                    Delete
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];

export function ProjectsTable({
  rows,
  total,
  page,
  pageSize,
  canCreate,
  canManage,
  clients,
  engineers,
  timeZone,
}: {
  rows: ProjectListRow[];
  total: number;
  page: number;
  pageSize: number;
  canCreate: boolean;
  canManage: boolean;
  clients: Option[];
  engineers: Option[];
  timeZone: string;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProjectListRow | null>(null);
  const { q, clearSearch } = useListQuery();

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      canManage,
      // Editing from the list opens the detail page — the team picker needs the
      // full record (members, scope) the list row doesn't carry.
      onEdit: (project) => router.push(`/projects/${project.id}` as Route),
      onDelete: (project) => setDeleteTarget(project),
      timeZone,
    } satisfies TableMeta,
  });

  return (
    <div className="space-y-4">
      {canCreate ? (
        <DirectoryToolbar
          searchPlaceholder="Search name or ref code"
          searchLabel="Search projects"
          newLabel="New project"
          newIcon={<Plus />}
          onNew={() => setCreateOpen(true)}
        />
      ) : (
        <SearchOnlyBar />
      )}

      {total === 0 ? (
        q ? (
          <DirectoryEmptyState
            icon={<FolderKanban className="size-5" />}
            title="No projects match your search"
            description="Try a different name or reference code — or clear the search to see everything."
            action={
              <Button variant="outline" onClick={clearSearch}>
                Clear search
              </Button>
            }
          />
        ) : canCreate ? (
          <DirectoryEmptyState
            icon={<FolderKanban className="size-5" />}
            title="No projects yet"
            description="Create a project to assign a team, track progress, and log daily site reports."
            action={
              <Button onClick={() => setCreateOpen(true)}>
                <Plus />
                New project
              </Button>
            }
          />
        ) : (
          <DirectoryEmptyState
            icon={<FolderKanban className="size-5" />}
            title="No projects assigned to you"
            description="When an admin adds you to a project, it shows up here with its schedule and reports."
          />
        )
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/40">
                {table.getHeaderGroups().map((group) => (
                  <TableRow key={group.id}>
                    {group.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      <span className="text-muted-foreground text-sm">
                        No results on this page.
                      </span>
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <TablePagination page={page} total={total} pageSize={pageSize} />
        </>
      )}

      {canCreate ? (
        <ProjectFormDialog
          open={createOpen}
          project={null}
          clients={clients}
          engineers={engineers}
          onOpenChange={setCreateOpen}
        />
      ) : null}

      <DeleteConfirm
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        id={deleteTarget?.id ?? null}
        name={deleteTarget?.name ?? null}
        noun="project"
        deleteAction={deleteProjectAction}
      />
    </div>
  );
}

// A non-admin viewer keeps the debounced search box but no "New project" button.
// Reuses the DirectoryToolbar's input styling and debounce behaviour.
function SearchOnlyBar() {
  const { q, setSearch } = useListQuery();
  const [value, setValue] = useState(q);
  const [lastQ, setLastQ] = useState(q);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  if (q !== lastQ) {
    setLastQ(q);
    setValue(q);
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    setValue(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setSearch(next), 300);
  }

  return (
    <div className="relative w-full max-w-xs">
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      <Input
        value={value}
        onChange={onChange}
        placeholder="Search name or ref code"
        className="pl-8"
        aria-label="Search projects"
      />
    </div>
  );
}
