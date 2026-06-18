"use client";

import { useState } from "react";
import type { Route } from "next";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { Eye, MoreHorizontal, Pencil, Plus, Trash2, Truck, Upload } from "lucide-react";
import { Link } from "react-transition-progress/next";

import { DeleteConfirm } from "@/components/directory/delete-confirm";
import { DirectoryToolbar } from "@/components/directory/directory-toolbar";
import { DirectoryEmptyState } from "@/components/directory/empty-state";
import { ImportDialog } from "@/components/directory/import-dialog";
import { TablePagination } from "@/components/directory/table-pagination";
import { useListQuery } from "@/components/directory/use-list-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/datetime";
import { bulkCreateSuppliersAction, deleteSupplierAction } from "@/modules/suppliers/actions";
import { supplierImportDescriptor } from "@/modules/suppliers/import";
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
    cell: ({ row }) => (
      <Link
        href={`/suppliers/${row.original.id}` as Route}
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
              <DropdownMenuItem render={<Link href={`/suppliers/${supplier.id}` as Route} />}>
                <Eye />
                View details
              </DropdownMenuItem>
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
  rows,
  total,
  page,
  pageSize,
  existingNames,
  timeZone,
}: {
  rows: SupplierRow[];
  total: number;
  page: number;
  pageSize: number;
  existingNames: string[];
  timeZone: string;
}) {
  const [form, setForm] = useState<FormState>(null);
  const [deleteTarget, setDeleteTarget] = useState<SupplierRow | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const { q, clearSearch } = useListQuery();

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
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
      <DirectoryToolbar
        searchPlaceholder="Search name, contact, email"
        searchLabel="Search suppliers"
        newLabel="New supplier"
        newIcon={<Plus />}
        onNew={() => setForm({ mode: "create" })}
        actions={
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload />
            Import
          </Button>
        }
      />

      {total === 0 ? (
        q ? (
          <DirectoryEmptyState
            icon={<Truck className="size-5" />}
            title="No suppliers match your search"
            description="Try a different name, contact, or email — or clear the search to see everyone."
            action={
              <Button variant="outline" onClick={clearSearch}>
                Clear search
              </Button>
            }
          />
        ) : (
          <DirectoryEmptyState
            icon={<Truck className="size-5" />}
            title="No suppliers yet"
            description="Add your first vendor to use it in stock-in and expenses."
            action={
              <Button onClick={() => setForm({ mode: "create" })}>
                <Plus />
                New supplier
              </Button>
            }
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

      <SupplierFormDialog
        open={form !== null}
        supplier={form?.mode === "edit" ? form.supplier : null}
        onOpenChange={(open) => {
          if (!open) setForm(null);
        }}
      />
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        descriptor={supplierImportDescriptor}
        existingKeys={existingNames}
        commitAction={bulkCreateSuppliersAction}
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
