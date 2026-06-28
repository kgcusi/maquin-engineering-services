import { Skeleton } from "@/components/ui/skeleton";

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

function PanelSkeleton({ rows }: { rows: number }) {
  return (
    <div className="bg-card ring-foreground/10 rounded-xl ring-1">
      <div className="border-b px-4 py-3">
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="space-y-4 px-4 py-4">
        {range(rows).map((r) => (
          <div key={r} className="flex items-center gap-3">
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-1.5 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {range(4).map((i) => (
          <div
            key={i}
            className="bg-card ring-foreground/10 flex items-center gap-3 rounded-xl p-4 ring-1"
          >
            <Skeleton className="size-10 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-6 w-10" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PanelSkeleton rows={4} />
        </div>
        <PanelSkeleton rows={3} />
      </div>
    </div>
  );
}
