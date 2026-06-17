"use client";

import { useMemo, useState } from "react";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Search, Trash2, UserCog, UserPlus, UserX } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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

export function UsersTable({ users, timeZone }: { users: UserRow[]; timeZone: string }) {
  const [form, setForm] = useState<FormState>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [users, query]);

  // TanStack Table returns non-memoizable functions; the React Compiler skips
  // optimizing this component, which is fine for a small client-side list.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filtered,
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email"
            className="pl-8"
            aria-label="Search users"
          />
        </div>
        <Button onClick={() => setForm({ mode: "create" })}>
          <UserPlus />
          New user
        </Button>
      </div>

      {users.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-14 text-center">
          <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full">
            <UserPlus className="size-5" />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-medium">No users yet</p>
            <p className="text-muted-foreground text-sm">
              Provision the first account to get started.
            </p>
          </div>
          <Button onClick={() => setForm({ mode: "create" })} className="mt-1">
            <UserPlus />
            New user
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
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
                    <span className="text-muted-foreground text-sm">No users match “{query}”.</span>
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
