import { Suspense } from "react";
import type { Metadata } from "next";

import { TableSkeleton } from "@/components/app-shell/page-skeletons";
import { ClientsTable } from "@/components/clients/clients-table";
import { requirePagePermission } from "@/lib/page-guards";
import { listClientNames, listClients } from "@/modules/clients/queries";
import { getSettings } from "@/modules/settings/queries";
import { directoryListSchema } from "@/modules/shared/list-params";

export const metadata: Metadata = { title: "Clients" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ClientsPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePagePermission("client.view");

  return (
    <div className="w-full space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Clients</h1>
        <p className="text-muted-foreground text-sm">
          The people and companies you deliver projects for. Open a client for documents and notes.
        </p>
      </header>

      <Suspense fallback={<TableSkeleton columns={6} toolbar />}>
        <ClientsSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ClientsSection({ searchParams }: { searchParams: SearchParams }) {
  const params = directoryListSchema.parse(await searchParams);
  const [result, existingNames, settings] = await Promise.all([
    listClients(params),
    listClientNames(),
    getSettings(),
  ]);

  return (
    <ClientsTable
      rows={result.rows}
      total={result.total}
      page={result.page}
      pageSize={result.pageSize}
      existingNames={existingNames}
      timeZone={settings.timezone}
    />
  );
}
