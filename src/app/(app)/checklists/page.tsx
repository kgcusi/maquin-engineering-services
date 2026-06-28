import { Suspense } from "react";
import type { Metadata } from "next";

import { TableSkeleton } from "@/components/app-shell/page-skeletons";
import { ChecklistsManager } from "@/components/checklists/checklists-manager";
import { requirePagePermission } from "@/lib/page-guards";
import { hasPermission } from "@/lib/rbac";
import { listChecklistsForAdmin } from "@/modules/projects/inspections/checklists/queries";

export const metadata: Metadata = { title: "Inspection Checklists" };

export default async function ChecklistsPage() {
  const session = await requirePagePermission("checklist.view");
  const role = (session.user as { role?: string | null }).role ?? null;

  return (
    <div className="w-full space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Inspection checklists</h1>
        <p className="text-muted-foreground text-sm">
          Reusable QA/QC checklists. A QA/QC engineer picks one when recording an inspection — its
          items are copied onto each attempt, so editing a checklist never rewrites past
          inspections.
        </p>
      </header>

      <Suspense fallback={<TableSkeleton columns={3} toolbar />}>
        <ChecklistsSection canManage={hasPermission(role, "checklist.manage")} />
      </Suspense>
    </div>
  );
}

async function ChecklistsSection({ canManage }: { canManage: boolean }) {
  const checklists = await listChecklistsForAdmin();
  return <ChecklistsManager checklists={checklists} canManage={canManage} />;
}
