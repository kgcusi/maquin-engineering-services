import { Badge } from "@/components/ui/badge";

// Status pill for a directory record (clients/employees/suppliers).
//   - "Deleted" wins: a soft-deleted record is only reachable on its detail page
//     (lists hide them), so flag it and stop.
//   - Otherwise show Active / Inactive — inactive records stay in the directory
//     but are excluded from selection elsewhere.
export function DirectoryStatusBadge({
  deleted = false,
  isActive = true,
}: {
  deleted?: boolean;
  isActive?: boolean;
}) {
  if (deleted) return <Badge variant="secondary">Deleted</Badge>;
  if (!isActive) return <Badge variant="destructive">Inactive</Badge>;
  return <Badge variant="outline">Active</Badge>;
}
