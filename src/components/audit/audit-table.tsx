"use client";

import type { Route } from "next";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Eye, ScrollText } from "lucide-react";

import { TablePagination } from "@/components/directory/table-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/datetime";
import { isHiddenRole } from "@/lib/roles";
import { actionLabel, entityTypeLabel } from "@/modules/audit/labels";
import type { AuditLogRow } from "@/modules/audit/queries";

import { AuditDetailDialog } from "./audit-detail-dialog";

// A null actor is a system action. The hidden superuser is masked as "System"
// for everyone EXCEPT a webmaster viewer (who already knows it exists) — that
// keeps the hidden-superuser invariant for admins while letting a webmaster see
// who really did what. Everyone else shows by their account name.
function maskActor(row: AuditLogRow, viewerIsWebmaster: boolean): boolean {
  if (row.actorId === null) return true;
  return isHiddenRole(row.actorRole) && !viewerIsWebmaster;
}

type Props = {
  rows: AuditLogRow[];
  page: number;
  total: number;
  pageSize: number;
  viewerIsWebmaster: boolean;
  /** Firm timezone (from settings) — timestamps render here. */
  timeZone: string;
};

export function AuditTable({ rows, page, total, pageSize, viewerIsWebmaster, timeZone }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [selected, setSelected] = useState<AuditLogRow | null>(null);

  const filtered = [...params.keys()].some((key) => key !== "page");

  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-14 text-center">
        <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full">
          <ScrollText className="size-5" />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-medium">
            {filtered ? "No events match these filters" : "No activity yet"}
          </p>
          <p className="text-muted-foreground text-sm">
            {filtered
              ? "Try widening the date range or clearing a filter."
              : "Every change made in the app will appear here."}
          </p>
        </div>
        {filtered && (
          <Button variant="outline" className="mt-1" onClick={() => router.push(pathname as Route)}>
            Clear filters
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Summary</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">View</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <span className="text-muted-foreground text-sm">No events on this page.</span>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`View details for ${row.action}`}
                  className="group cursor-pointer"
                  onClick={() => setSelected(row)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(row);
                    }
                  }}
                >
                  <TableCell className="text-muted-foreground tabular-nums">
                    {formatDateTime(row.createdAt, timeZone, "datetime")}
                  </TableCell>
                  <TableCell>
                    {maskActor(row, viewerIsWebmaster) ? (
                      <span className="text-muted-foreground">System</span>
                    ) : (
                      <div className="flex flex-col">
                        <span className="font-medium">{row.actorName ?? "Unknown user"}</span>
                        {row.actorEmail ? (
                          <span className="text-muted-foreground text-xs">{row.actorEmail}</span>
                        ) : null}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{actionLabel(row.action)}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {entityTypeLabel(row.entityType)}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-sm truncate">
                    {row.summary}
                  </TableCell>
                  <TableCell className="w-12 text-right">
                    <span
                      aria-hidden
                      className="border-border bg-background text-muted-foreground group-hover:border-primary/40 group-hover:bg-primary/10 group-hover:text-primary inline-flex size-8 items-center justify-center rounded-md border transition-colors"
                    >
                      <Eye className="size-4" />
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <TablePagination page={page} total={total} pageSize={pageSize} />

      <AuditDetailDialog
        row={selected}
        viewerIsWebmaster={viewerIsWebmaster}
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}
