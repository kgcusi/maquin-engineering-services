import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { DashboardSummary } from "@/components/dashboard/dashboard-summary";
import { getSession } from "@/lib/session";
import { getDashboard, type DashboardViewer } from "@/modules/dashboard/queries";

export const metadata: Metadata = { title: "Dashboard" };

// The universal landing — every authenticated user lands here, and it's the
// redirect target page-guards use when someone lacks a page's permission. So it
// gates on the SESSION only (never a permission key); the (app) layout's AuthGate
// already proved the account is active. The view itself adapts by role inside
// getDashboard: admins (project.view.all) see firm-wide aggregates, everyone else
// sees only their own tasks and projects.
export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const role = (session.user as { role?: string | null }).role ?? null;
  const viewer: DashboardViewer = { id: session.user.id, role };
  const firstName = (session.user.name ?? "").trim().split(/\s+/)[0] || null;

  return (
    <div className="w-full space-y-6">
      <header>
        <p className="text-primary text-xs font-semibold tracking-[0.12em] uppercase">
          MAQUIN Engineering Services
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">
          {firstName ? `Welcome back, ${firstName}` : "Dashboard"}
        </h1>
      </header>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardSection viewer={viewer} />
      </Suspense>
    </div>
  );
}

async function DashboardSection({ viewer }: { viewer: DashboardViewer }) {
  const dashboard = await getDashboard(viewer);
  return <DashboardSummary dashboard={dashboard} />;
}
