import {
  FiltersSkeleton,
  ListPageHeaderSkeleton,
  TableSkeleton,
} from "@/components/app-shell/page-skeletons";

export default function Loading() {
  return (
    <div className="w-full space-y-6">
      <ListPageHeaderSkeleton />
      <FiltersSkeleton />
      <TableSkeleton columns={6} />
    </div>
  );
}
