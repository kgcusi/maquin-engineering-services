"use client";

import { useMemo, useState } from "react";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Plus, Search, Trash2, Truck } from "lucide-react";

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
import { deleteSupplierAction } from "@/modules/suppliers/actions";
import type { SupplierRow } from "@/modules/suppliers/queries";

import { SupplierFormDialog } from "./supplier-form-dialog";

type FormState = { mode: "create" } | { mode: "edit"; supplier: SupplierRow } | null;

type TableMeta = {
  onEdit: (s: SupplierRow) => void;
  onDelete: (s: SupplierRow) => void;
  timeZone: string;
};

const columns: ColumnDef<SupplierRow>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
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
      const supplier = row.original;
      const meta = table.options.meta as TableMeta;
      return (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label={`Manage ${supplier.name}`} />
              }
            >
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => meta.onEdit(supplier)}>
                <Pencil />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => meta.onDelete(supplier)}>
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

export function SuppliersTable({
  suppliers,
  timeZone,
}: {
  suppliers: SupplierRow[];
  timeZone: string;
}) {
  const [form, setForm] = useState<FormState>(null);
  const [deleteTarget, setDeleteTarget] = useState<SupplierRow | null>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) =>
      [s.name, s.contactPerson, s.email].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [suppliers, query]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      onEdit: (supplier) => setForm({ mode: "edit", supplier }),
      onDelete: (supplier) => setDeleteTarget(supplier),
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
            aria-label="Search suppliers"
          />
        </div>
        <Button onClick={() => setForm({ mode: "create" })}>
          <Plus />
          New supplier
        </Button>
      </div>

      {suppliers.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-14 text-center">
          <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full">
            <Truck className="size-5" />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-medium">No suppliers yet</p>
            <p className="text-muted-foreground text-sm">
              Add your first vendor to use it in stock-in and expenses.
            </p>
          </div>
          <Button onClick={() => setForm({ mode: "create" })} className="mt-1">
            <Plus />
            New supplier
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
                      No suppliers match your search.
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

      <SupplierFormDialog
        open={form !== null}
        supplier={form?.mode === "edit" ? form.supplier : null}
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
        noun="supplier"
        deleteAction={deleteSupplierAction}
      />
    </div>
  );
}
