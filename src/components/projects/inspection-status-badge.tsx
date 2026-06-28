import { Badge } from "@/components/ui/badge";
import { inspectionStatusLabel, type InspectionStatus } from "@/lib/statuses";

// QA/QC inspection pill — REQUESTED reads as a pending amber, PASSED as an
// affirmative emerald, FAILED as a destructive red. Spellings come from
// @/lib/statuses so they can't drift from the stored enum.
const VARIANTS: Record<InspectionStatus, string> = {
  REQUESTED:
    "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:border-amber-400/30 dark:text-amber-400",
  PASSED:
    "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/30 dark:text-emerald-400",
  FAILED: "border-red-500/40 bg-red-500/10 text-red-700 dark:border-red-400/30 dark:text-red-400",
};

export function InspectionStatusBadge({ status }: { status: string }) {
  const className = VARIANTS[status as InspectionStatus] ?? "border-border text-muted-foreground";
  return (
    <Badge variant="outline" className={className}>
      {inspectionStatusLabel(status)}
    </Badge>
  );
}
