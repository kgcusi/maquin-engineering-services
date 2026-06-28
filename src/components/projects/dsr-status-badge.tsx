import { Badge } from "@/components/ui/badge";
import { dsrStatusLabel, type DsrStatus } from "@/lib/statuses";

// DSR lifecycle pill — DRAFT is a neutral in-progress outline, SUBMITTED an awaiting-
// review blue, APPROVED a settled, affirmative emerald. Spellings come from
// @/lib/statuses so they can't drift from the stored enum.
const VARIANTS: Record<DsrStatus, string> = {
  DRAFT: "border-border text-muted-foreground",
  SUBMITTED:
    "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:border-blue-400/30 dark:text-blue-400",
  APPROVED:
    "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/30 dark:text-emerald-400",
};

export function DsrStatusBadge({ status }: { status: string }) {
  const className = VARIANTS[status as DsrStatus] ?? "border-border text-muted-foreground";
  return (
    <Badge variant="outline" className={className}>
      {dsrStatusLabel(status)}
    </Badge>
  );
}
