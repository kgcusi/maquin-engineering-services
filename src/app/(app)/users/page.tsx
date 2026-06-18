import { Suspense } from "react";
import type { Metadata } from "next";

import { TableSkeleton } from "@/components/app-shell/page-skeletons";
import { UsersTable } from "@/components/users/users-table";
import { requirePagePermission } from "@/lib/page-guards";
import { getSettings } from "@/modules/settings/queries";
import { directoryListSchema } from "@/modules/shared/list-params";
import { listVisibleUsers } from "@/modules/users/queries";

export const metadata: Metadata = { title: "Users" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function UsersPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePagePermission("user.view");

  return (
    <div className="w-full space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Users</h1>
        <p className="text-muted-foreground text-sm">
          Provision accounts and manage access. Accounts are created here — there is no public
          sign-up.
        </p>
      </header>

      <Suspense fallback={<TableSkeleton columns={6} toolbar />}>
        <UsersSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function UsersSection({ searchParams }: { searchParams: SearchParams }) {
  const params = directoryListSchema.parse(await searchParams);
  const [result, settings] = await Promise.all([listVisibleUsers(params), getSettings()]);

  return (
    <UsersTable
      rows={result.rows}
      total={result.total}
      page={result.page}
      pageSize={result.pageSize}
      timeZone={settings.timezone}
    />
  );
}
