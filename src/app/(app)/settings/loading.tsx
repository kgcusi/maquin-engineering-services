import { ListPageHeaderSkeleton } from "@/components/app-shell/page-skeletons";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="w-full space-y-6">
      <ListPageHeaderSkeleton />
      {[0, 1, 2].map((i) => (
        <Card key={i}>
          <CardHeader className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full max-w-md" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-9 w-full max-w-sm" />
            <Skeleton className="h-9 w-full max-w-sm" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
