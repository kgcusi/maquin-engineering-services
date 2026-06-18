"use client";

import { useState } from "react";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Trash2, UserCog, UserPlus, Users, UserX } from "lucide-react";

import { DirectoryToolbar } from "@/components/directory/directory-toolbar";
import { DirectoryEmptyState } from "@/components/directory/empty-state";
import { TablePagination } from "@/components/directory/table-pagination";
import { useListQuery } from "@/components/directory/use-list-query";
import { Badge } from "@/components/ui/badge";
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
import { ROLES, roleLabel } from "@/lib/roles";
import type { UserRow } from "@/modules/users/queries";

import { DeactivateConfirm } from "./deactivate-confirm";
import { DeleteConfirm } from "./delete-confirm";
import { UserFormDialog } from "./user-form-dialog";

type FormState = { mode: "create" } | { mode: "edit"; user: UserRow } | null;
type ConfirmState = { user: UserRow; mode: "deactivate" | "reactivate" } | null;

type TableMeta = {
  onEdit: (user: UserRow) => void;
  onToggle: (user: UserRow) => void;
  onDelete: (user: UserRow) => void;
  timeZone: string;
};

function RoleBadge({ role }: { role: string | null }) {
  return <Badge variant={role === ROLES.ADMIN ? "default" : "secondary"}>{roleLabel(role)}</Badge>;
}

function StatusBadge({ isActive }: { isActive: boolean | null }) {
  if (isActive === false) return <Badge variant="destructive">Inactive</Badge>;
  return <Badge variant="outline">Active</Badge>;
}

const columns: ColumnDef<UserRow>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.email}</span>,
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => <RoleBadge role={row.original.role} />,
  },
  {
    accessorKey: "isActive",
    header: "Status",
    cell: ({ row }) => <StatusBadge isActive={row.original.isActive} />,
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
      const user = row.original;
      const meta = table.options.meta as TableMeta;
      const inactive = user.isActive === false;
      return (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" aria-label={`Manage ${user.name}`} />}
            >
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => meta.onEdit(user)}>
                <UserCog />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                variant={inactive ? "default" : "destructive"}
                onClick={() => meta.onToggle(user)}
              >
                <UserX />
                {inactive ? "Reactivate" : "Deactivate"}
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => meta.onDelete(user)}>
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

export function UsersTable({
  rows,
  total,
  page,
  pageSize,
  timeZone,
}: {
  rows: UserRow[];
  total: number;
  page: number;
  pageSize: number;
  timeZone: string;
}) {
  const [form, setForm] = useState<FormState>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const { q, clearSearch } = useListQuery();

  // TanStack Table returns non-memoizable functions; the React Compiler skips
  // optimizing this component, which is fine for a small client-side list.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      onEdit: (user) => setForm({ mode: "edit", user }),
      onToggle: (user) =>
        setConfirm({ user, mode: user.isActive === false ? "reactivate" : "deactivate" }),
      onDelete: (user) => setDeleteTarget(user),
      timeZone,
    } satisfies TableMeta,
  });

  return (
    <div className="space-y-4">
      <DirectoryToolbar
        searchPlaceholder="Search name or email"
        searchLabel="Search users"
        newLabel="New user"
        newIcon={<UserPlus />}
        onNew={() => setForm({ mode: "create" })}
      />

      {total === 0 ? (
        q ? (
          <DirectoryEmptyState
            icon={<Users className="size-5" />}
            title="No users match your search"
            description="Try a different name or email — or clear the search to see everyone."
            action={
              <Button variant="outline" onClick={clearSearch}>
                Clear search
              </Button>
            }
          />
        ) : (
          <DirectoryEmptyState
            icon={<Users className="size-5" />}
            title="No users yet"
            description="Provision the first account to get started."
            action={
              <Button onClick={() => setForm({ mode: "create" })}>
                <UserPlus />
                New user
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

      <UserFormDialog
        open={form !== null}
        user={form?.mode === "edit" ? form.user : null}
        onOpenChange={(open) => {
          if (!open) setForm(null);
        }}
      />
      <DeactivateConfirm
        open={confirm !== null}
        user={confirm?.user ?? null}
        mode={confirm?.mode ?? "deactivate"}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      />
      <DeleteConfirm
        open={deleteTarget !== null}
        user={deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      />
    </div>
  );
}
