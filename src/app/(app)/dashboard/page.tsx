import type { Metadata } from "next";
import { LineChart, Boxes, Wallet } from "lucide-react";

export const metadata: Metadata = { title: "Dashboard" };

// Designed empty state (firm rule: no bare "No data"). Once projects, inventory
// and finance data exist, this page becomes the at-a-glance command center;
// until then it stays deliberately quiet rather than showing hollow placeholders.
export default function DashboardPage() {
  return (
    <div className="w-full">
      <header>
        <p className="text-primary text-xs font-semibold tracking-[0.12em] uppercase">
          MAQUIN Engineering Services
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">Dashboard</h1>
      </header>

      <div className="relative mt-6 flex min-h-[58vh] flex-col items-center justify-center overflow-hidden rounded-2xl border text-center">
        {/* Soft blueprint-green wash + faint grid so the empty surface reads as
            intentional, not blank. */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(var(--primary) 1px, transparent 1px), linear-gradient(90deg, var(--primary) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
          aria-hidden
        />
        <div className="from-primary/[0.07] pointer-events-none absolute inset-0 bg-gradient-to-b to-transparent" />

        <div className="relative px-6">
          <span className="bg-primary/10 text-primary ring-primary/15 mx-auto flex size-16 items-center justify-center rounded-2xl ring-1">
            <LineChart className="size-8" strokeWidth={1.75} />
          </span>

          <h2 className="mt-5 text-lg font-semibold tracking-tight">Nothing to track yet</h2>
          <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm text-balance">
            Your projects, materials, and cash position will surface here the moment there is data
            to show. For now, the system is set up and ready.
          </p>

          <div className="text-muted-foreground/80 mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium">
            <span className="flex items-center gap-1.5">
              <LineChart className="text-chart-1 size-3.5" /> Project progress
            </span>
            <span className="flex items-center gap-1.5">
              <Boxes className="text-chart-2 size-3.5" /> Stock levels
            </span>
            <span className="flex items-center gap-1.5">
              <Wallet className="text-chart-4 size-3.5" /> Cash position
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
