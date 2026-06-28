// Shared progress meter — a thin bar + clamped percentage. Pure markup (no client
// hooks) so it renders in both the client projects table and the server dashboard.
export function ProgressMeter({ pct, className }: { pct: number; className?: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <div className="bg-muted h-1.5 w-20 overflow-hidden rounded-full">
        <div
          className="bg-primary h-full rounded-full transition-[width]"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="text-muted-foreground w-9 text-right text-xs tabular-nums">{clamped}%</span>
    </div>
  );
}
