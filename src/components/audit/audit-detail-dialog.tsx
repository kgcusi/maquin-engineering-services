"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isHiddenRole } from "@/lib/roles";
import { actionLabel, entityTypeLabel, humanizeKey } from "@/modules/audit/labels";
import type { AuditLogRow } from "@/modules/audit/queries";

const stamp = new Intl.DateTimeFormat(undefined, { dateStyle: "long", timeStyle: "medium" });

// Null actors are system actions; the hidden superuser is masked as "System"
// for non-webmaster viewers only (matches the table — docs/03 invariant).
function maskActor(row: AuditLogRow, viewerIsWebmaster: boolean): boolean {
  if (row.actorId === null) return true;
  return isHiddenRole(row.actorRole) && !viewerIsWebmaster;
}

type DiffEntry = { from?: unknown; to?: unknown };

function isDiffEntry(value: unknown): value is DiffEntry {
  return typeof value === "object" && value !== null && ("from" in value || "to" in value);
}

function show(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return typeof value === "string" ? value : JSON.stringify(value);
}

function DiffView({ diff }: { diff: unknown }) {
  if (
    diff === null ||
    diff === undefined ||
    typeof diff !== "object" ||
    Object.keys(diff).length === 0
  ) {
    // A non-object payload is unexpected, but show it as one readable line
    // rather than a JSON blob; null/empty means there was nothing to record.
    if (diff != null && typeof diff !== "object") return <p className="text-sm">{show(diff)}</p>;
    return <p className="text-muted-foreground text-sm">No field-level changes were recorded.</p>;
  }

  const entries = Object.entries(diff as Record<string, unknown>);

  // An update carries `{ from, to }` entries — show an explicit Before / After
  // table so the change is unambiguous. A create carries plain values, so it
  // has no "before": render a simple field → value list instead.
  if (entries.some(([, value]) => isDiffEntry(value))) {
    const cols = "grid grid-cols-[7rem_minmax(0,1fr)_minmax(0,1fr)] gap-3 px-3 py-2";
    return (
      <div className="overflow-hidden rounded-lg border text-sm">
        <div
          className={`${cols} bg-muted/40 text-muted-foreground text-[0.7rem] font-medium tracking-wide uppercase`}
        >
          <span>Field</span>
          <span>Before</span>
          <span>After</span>
        </div>
        <dl className="divide-border divide-y">
          {entries.map(([field, value]) => {
            const from = isDiffEntry(value) ? value.from : undefined;
            const to = isDiffEntry(value) ? value.to : value;
            return (
              <div key={field} className={cols}>
                <dt className="text-muted-foreground font-medium">{humanizeKey(field)}</dt>
                <dd className="text-muted-foreground break-words line-through">{show(from)}</dd>
                <dd className="font-medium break-words">{show(to)}</dd>
              </div>
            );
          })}
        </dl>
      </div>
    );
  }

  return (
    <dl className="divide-border divide-y rounded-lg border text-sm">
      {entries.map(([field, value]) => (
        <div key={field} className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 px-3 py-2">
          <dt className="text-muted-foreground font-medium">{humanizeKey(field)}</dt>
          <dd className="font-medium break-words">{show(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[6rem_1fr] gap-3">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  );
}

export function AuditDetailDialog({
  row,
  viewerIsWebmaster,
  open,
  onOpenChange,
}: {
  row: AuditLogRow | null;
  viewerIsWebmaster: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Audit event</DialogTitle>
          <DialogDescription>{row ? row.summary : null}</DialogDescription>
        </DialogHeader>

        {row && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Row label="When">{stamp.format(new Date(row.createdAt))}</Row>
              <Row label="Actor">
                {maskActor(row, viewerIsWebmaster) ? (
                  <span className="text-muted-foreground">System</span>
                ) : (
                  <>
                    {row.actorName ?? "Unknown user"}
                    {row.actorEmail ? (
                      <span className="text-muted-foreground"> · {row.actorEmail}</span>
                    ) : null}
                  </>
                )}
              </Row>
              <Row label="Action">
                <span className="font-medium">{actionLabel(row.action)}</span>
              </Row>
              <Row label="Entity">{entityTypeLabel(row.entityType)}</Row>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Changes</p>
              <DiffView diff={row.diff} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
