"use client";

import { useMemo, useState } from "react";
import type { Route } from "next";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { Building2, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Link } from "react-transition-progress/next";

import { DeleteConfirm } from "@/components/directory/delete-confirm";
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
import { deleteClientAction } from "@/modules/clients/actions";
import type { ClientRow } from "@/modules/clients/queries";

import { ClientFormDialog } from "./client-form-dialog";

type FormState = { mode: "create" } | { mode: "edit"; client: ClientRow } | null;

type TableMeta = {
  onEdit: (c: ClientRow) => void;
  onDelete: (c: ClientRow) => void;
  timeZone: string;
};

const columns: ColumnDef<ClientRow>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <Link
        href={`/clients/${row.original.id}` as Route}
        className="hover:text-primary font-medium underline-offset-4 hover:underline"
      >
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: "contactPerson",
    header: "Contact",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.contactPerson ?? "—"}</span>
    ),
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.email ?? "—"}</span>,
  },
  {
    accessorKey: "phone",
    header: "Phone",
    cell: ({ row }) => (
      <span className="text-muted-foreground tabular-nums">{row.original.phone ?? "—"}</span>
    ),
  },
  {
    accessorKey: "createdAt",
    header: "Added",
    cell: ({ row, table }) => (
      <span className="text-muted-foreground tabular-nums">
        {formatDateTime(row.original.createdAt, (table.options.meta as TableMeta).timeZone, "date")}
      </span>
    ),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row, table }) => {
      const client = row.original;
      const meta = table.options.meta as TableMeta;
      return (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label={`Manage ${client.name}`} />
              }
            >
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => meta.onEdit(client)}>
                <Pencil />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => meta.onDelete(client)}>
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];

export function ClientsTable({ clients, timeZone }: { clients: ClientRow[]; timeZone: string }) {
  const [form, setForm] = useState<FormState>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClientRow | null>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      [c.name, c.contactPerson, c.email].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [clients, query]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      onEdit: (client) => setForm({ mode: "edit", client }),
      onDelete: (client) => setDeleteTarget(client),
      timeZone,
    } satisfies TableMeta,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, contact, email"
            className="pl-8"
            aria-label="Search clients"
          />
        </div>
        <Button onClick={() => setForm({ mode: "create" })}>
          <Plus />
          New client
        </Button>
      </div>

      {clients.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-14 text-center">
          <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full">
            <Building2 className="size-5" />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-medium">No clients yet</p>
            <p className="text-muted-foreground text-sm">
              Add a client to track projects, documents, and notes against.
            </p>
          </div>
          <Button onClick={() => setForm({ mode: "create" })} className="mt-1">
            <Plus />
            New client
          </Button>
        </div>
      ) : (
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
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    <span className="text-muted-foreground text-sm">
                      No clients match your search.
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
      )}

      <ClientFormDialog
        open={form !== null}
        client={form?.mode === "edit" ? form.client : null}
        onOpenChange={(open) => {
          if (!open) setForm(null);
        }}
      />
      <DeleteConfirm
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        id={deleteTarget?.id ?? null}
        name={deleteTarget?.name ?? null}
        noun="client"
        deleteAction={deleteClientAction}
      />
    </div>
  );
}
