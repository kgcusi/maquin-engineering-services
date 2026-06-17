import { Badge } from "@/components/ui/badge";

// Shown on a detail page reached for a soft-deleted record (lists hide them).
// Renders nothing for a live record.
export function DirectoryStatusBadge({ deleted }: { deleted: boolean }) {
  if (!deleted) return null;
  return <Badge variant="secondary">Deleted</Badge>;
}
