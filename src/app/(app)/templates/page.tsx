import { Suspense } from "react";
import type { Metadata } from "next";

import { TableSkeleton } from "@/components/app-shell/page-skeletons";
import { TemplatesManager } from "@/components/templates/templates-manager";
import { requirePagePermission } from "@/lib/page-guards";
import { hasPermission } from "@/lib/rbac";
import { listTemplatesForAdmin } from "@/modules/projects/templates/queries";

export const metadata: Metadata = { title: "Project templates" };

export default async function TemplatesPage() {
  const session = await requirePagePermission("template.view");
  const role = (session.user as { role?: string | null }).role ?? null;
  const canManage = hasPermission(role, "template.manage");

  return (
    <div className="w-full space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Project templates</h1>
        <p className="text-muted-foreground text-sm">
          {canManage
            ? "Reusable skeletons of phases and tasks. Authoring one here lets a new project spin up a full schedule from a single start date."
            : "Reusable skeletons of phases and tasks used to set up new projects."}
        </p>
      </header>

      <Suspense fallback={<TableSkeleton columns={4} />}>
        <TemplatesSection canManage={canManage} />
      </Suspense>
    </div>
  );
}

async function TemplatesSection({ canManage }: { canManage: boolean }) {
  const templates = await listTemplatesForAdmin();
  return <TemplatesManager templates={templates} canManage={canManage} />;
}
