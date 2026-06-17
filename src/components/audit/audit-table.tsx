"use client";

import type { Route } from "next";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Eye, ScrollText } from "lucide-react";

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
  hasNext: boolean;
  viewerIsWebmaster: boolean;
  /** Firm timezone (from settings) — timestamps render here. */
  timeZone: string;
};

export function AuditTable({ rows, page, hasNext, viewerIsWebmaster, timeZone }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [selected, setSelected] = useState<AuditLogRow | null>(null);

  const filtered = [...params.keys()].some((key) => key !== "page");

  function go(targetPage: number) {
    const next = new URLSearchParams(params.toString());
    if (targetPage <= 1) next.delete("page");
    else next.set("page", String(targetPage));
    const qs = next.toString();
    router.push((qs ? `${pathname}?${qs}` : pathname) as Route);
  }

  if (rows.length === 0) {
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
      <div className="overflow-hidden rounded-lg border">
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
            {rows.map((row) => (
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
                  <Eye className="text-muted-foreground/60 group-hover:text-foreground inline-block size-4 transition-colors" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {(hasNext || page > 1) && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">Page {page}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => go(page - 1)}>
              <ChevronLeft />
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={!hasNext} onClick={() => go(page + 1)}>
              Next
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}

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
