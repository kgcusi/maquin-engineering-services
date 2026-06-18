import { Suspense } from "react";
import type { Metadata } from "next";

import { FiltersSkeleton, TableSkeleton } from "@/components/app-shell/page-skeletons";
import { AuditFilters } from "@/components/audit/audit-filters";
import { AuditTable } from "@/components/audit/audit-table";
import { requirePagePermission } from "@/lib/page-guards";
import { isHiddenRole } from "@/lib/roles";
import {
  listActionOptions,
  listActorOptions,
  listAuditLogs,
  listEntityTypeOptions,
} from "@/modules/audit/queries";
import { auditFilterSchema } from "@/modules/audit/schema";
import { getSettings } from "@/modules/settings/queries";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePagePermission("audit.view");
  // A webmaster viewer sees real actor names (incl. other webmasters); for any
  // other viewer the hidden superuser stays masked as "System" in the table and
  // absent from the actor filter — the hidden-superuser invariant (docs/03).
  const viewerIsWebmaster = isHiddenRole((session.user as { role?: string | null }).role);

  return (
    <div className="w-full space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Audit log</h1>
        <p className="text-muted-foreground text-sm">
          An immutable record of every change — who did what, and when. Select a row to see the
          details.
        </p>
      </header>

      <Suspense
        fallback={
          <div className="space-y-6">
            <FiltersSkeleton />
            <TableSkeleton columns={6} />
          </div>
        }
      >
        <AuditSection searchParams={searchParams} viewerIsWebmaster={viewerIsWebmaster} />
      </Suspense>
    </div>
  );
}

async function AuditSection({
  searchParams,
  viewerIsWebmaster,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  viewerIsWebmaster: boolean;
}) {
  const filters = auditFilterSchema.parse(await searchParams);
  const [result, actors, actions, entityTypes, settings] = await Promise.all([
    listAuditLogs(filters, viewerIsWebmaster),
    listActorOptions(viewerIsWebmaster),
    listActionOptions(),
    listEntityTypeOptions(),
    getSettings(),
  ]);

  return (
    <div className="space-y-6">
      <AuditFilters actors={actors} actions={actions} entityTypes={entityTypes} />
      <AuditTable
        rows={result.rows}
        page={result.page}
        total={result.total}
        pageSize={result.pageSize}
        viewerIsWebmaster={viewerIsWebmaster}
        timeZone={settings.timezone}
      />
    </div>
  );
}
