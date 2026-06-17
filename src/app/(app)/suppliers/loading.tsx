import { ListPageHeaderSkeleton, TableSkeleton } from "@/components/app-shell/page-skeletons";

export default function Loading() {
  return (
    <div className="w-full space-y-6">
      <ListPageHeaderSkeleton />
      <TableSkeleton columns={6} toolbar />
    </div>
  );
}
