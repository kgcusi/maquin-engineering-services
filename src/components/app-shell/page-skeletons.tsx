import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** Title + description placeholder — mirrors the `<header className="space-y-1">` on list pages. */
export function ListPageHeaderSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-7 w-44" />
      <Skeleton className="h-4 w-full max-w-md" />
    </div>
  );
}

/** A row of control placeholders sized to the audit filter bar. */
export function FiltersSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-9 w-44" />
    </div>
  );
}

/**
 * Bordered table placeholder sized to the real table (`columns` cells per row).
 * Set `toolbar` for directory tables that carry a search box + primary action.
 */
export function TableSkeleton({
  columns,
  rows = 5,
  toolbar = false,
}: {
  columns: number;
  rows?: number;
  toolbar?: boolean;
}) {
  return (
    <div className="space-y-4">
      {toolbar ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-9 w-full max-w-xs" />
          <Skeleton className="h-9 w-32" />
        </div>
      ) : null}
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              {range(columns).map((c) => (
                <TableHead key={c}>
                  <Skeleton className="h-4 w-20" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {range(rows).map((r) => (
              <TableRow key={r}>
                {range(columns).map((c) => (
                  <TableCell key={c}>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/** Entity detail placeholder — back link, title block, tab bar, and an info grid. */
export function DetailPageSkeleton() {
  return (
    <div className="w-full space-y-6">
      <Skeleton className="h-4 w-24" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-36" />
        </div>
        <Skeleton className="h-9 w-20" />
      </div>
      <div className="flex gap-4 border-b pb-2">
        <Skeleton className="h-5 w-12" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-20" />
      </div>
      <div className="grid max-w-2xl gap-5 sm:grid-cols-2">
        {range(4).map((i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}
