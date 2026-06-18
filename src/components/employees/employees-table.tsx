"use client";

import { useState } from "react";
import type { Route } from "next";
import { Link } from "react-transition-progress/next";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { Contact, Eye, MoreHorizontal, Pencil, Plus, Trash2, Upload } from "lucide-react";

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
import { formatCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/datetime";
import { rateUnitLabel } from "@/lib/lookups";
import { bulkCreateEmployeesAction, deleteEmployeeAction } from "@/modules/employees/actions";
import { employeeImportDescriptor } from "@/modules/employees/import";
import type { EmployeeRow } from "@/modules/employees/queries";

import { EmployeeFormDialog } from "./employee-form-dialog";

type FormState = { mode: "create" } | { mode: "edit"; employee: EmployeeRow } | null;

type TableMeta = {
  onEdit: (e: EmployeeRow) => void;
  onDelete: (e: EmployeeRow) => void;
  timeZone: string;
  currency: string;
};

const columns: ColumnDef<EmployeeRow>[] = [
  {
    accessorKey: "fullName",
    header: "Name",
    cell: ({ row }) => (
      <Link
        href={`/employees/${row.original.id}` as Route}
        className="hover:text-primary font-medium underline-offset-4 hover:underline"
      >
        {row.original.fullName}
      </Link>
    ),
  },
  {
    accessorKey: "position",
    header: "Position",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.position ?? "—"}</span>
    ),
  },
  {
    accessorKey: "phone",
    header: "Phone",
    cell: ({ row }) => (
      <span className="text-muted-foreground tabular-nums">{row.original.phone ?? "—"}</span>
    ),
  },
  {
    id: "rate",
    header: "Rate",
    cell: ({ row, table }) => {
      const { currency } = table.options.meta as TableMeta;
      if (!row.original.rate) return <span className="text-muted-foreground">—</span>;
      return (
        <span className="tabular-nums">
          {formatCurrency(row.original.rate, currency)}
          <span className="text-muted-foreground"> · {rateUnitLabel(row.original.rateUnit)}</span>
        </span>
      );
    },
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
      const employee = row.original;
      const meta = table.options.meta as TableMeta;
      return (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label={`Manage ${employee.fullName}`} />
              }
            >
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem render={<Link href={`/employees/${employee.id}` as Route} />}>
                <Eye />
                View details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => meta.onEdit(employee)}>
                <Pencil />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => meta.onDelete(employee)}>
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

export function EmployeesTable({
  rows,
  total,
  page,
  pageSize,
  positions,
  existingNames,
  timeZone,
  currency,
}: {
  rows: EmployeeRow[];
  total: number;
  page: number;
  pageSize: number;
  positions: string[];
  existingNames: string[];
  timeZone: string;
  currency: string;
}) {
  const [form, setForm] = useState<FormState>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmployeeRow | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const { q, clearSearch } = useListQuery();

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      onEdit: (employee) => setForm({ mode: "edit", employee }),
      onDelete: (employee) => setDeleteTarget(employee),
      timeZone,
      currency,
    } satisfies TableMeta,
  });

  return (
    <div className="space-y-4">
      <DirectoryToolbar
        searchPlaceholder="Search name, position, contact"
        searchLabel="Search employees"
        newLabel="New employee"
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
            icon={<Contact className="size-5" />}
            title="No employees match your search"
            description="Try a different name, position, or contact — or clear the search to see everyone."
            action={
              <Button variant="outline" onClick={clearSearch}>
                Clear search
              </Button>
            }
          />
        ) : (
          <DirectoryEmptyState
            icon={<Contact className="size-5" />}
            title="No employees yet"
            description="Add people to reference them in daily reports, receipts, and HR records."
            action={
              <Button onClick={() => setForm({ mode: "create" })}>
                <Plus />
                New employee
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

      <EmployeeFormDialog
        open={form !== null}
        employee={form?.mode === "edit" ? form.employee : null}
        positions={positions}
        onOpenChange={(open) => {
          if (!open) setForm(null);
        }}
      />
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        descriptor={employeeImportDescriptor}
        existingKeys={existingNames}
        commitAction={bulkCreateEmployeesAction}
      />
      <DeleteConfirm
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        id={deleteTarget?.id ?? null}
        name={deleteTarget?.fullName ?? null}
        noun="employee"
        deleteAction={deleteEmployeeAction}
      />
    </div>
  );
}
