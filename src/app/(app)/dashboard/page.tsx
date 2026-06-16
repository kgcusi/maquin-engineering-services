import type { Metadata } from "next";
import {
  Circle,
  MapPin,
  Package,
  Building2,
  FolderPlus,
  UserCog,
  TrendingUp,
  Boxes,
  Wallet,
  ClipboardList,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Dashboard" };

// First-run setup checklist (docs/17 §6) — guides the admin from an empty
// system to a working one. Wired to live data once the modules land.
const SETUP_STEPS = [
  { icon: MapPin, label: "Add a storage location", hint: "Warehouse or yard" },
  { icon: Package, label: "Add inventory items", hint: "What you stock" },
  { icon: Building2, label: "Add a client", hint: "Who the work is for" },
  { icon: FolderPlus, label: "Create a project", hint: "Auto-creates its site" },
  { icon: UserCog, label: "Assign an engineer", hint: "Scope them to it" },
];

const METRICS = [
  { icon: TrendingUp, label: "Active projects", hint: "Stage 2" },
  { icon: Boxes, label: "Items low on stock", hint: "Stage 3" },
  { icon: Wallet, label: "Pending approvals", hint: "Stage 4" },
  { icon: ClipboardList, label: "Reports today", hint: "Stage 5" },
];

export default function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Foundation is in place. Once data exists, this becomes your at-a-glance view of projects,
          materials, and money.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {METRICS.map((m) => (
          <Card key={m.label}>
            <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">{m.label}</CardTitle>
              <m.icon className="text-muted-foreground size-4" />
            </CardHeader>
            <CardContent>
              <div className="text-muted-foreground/60 text-2xl font-semibold">—</div>
              <p className="text-muted-foreground mt-1 text-xs">{m.hint}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Get set up</CardTitle>
          <CardDescription>
            A few steps to take the system from empty to operational.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {SETUP_STEPS.map((step, i) => (
            <div key={step.label} className="flex items-center gap-3 rounded-md px-2 py-2.5">
              <span className="text-muted-foreground/40 relative flex size-5 items-center justify-center">
                <Circle className="size-5" strokeWidth={1.5} />
                <span className="absolute text-[10px] font-medium">{i + 1}</span>
              </span>
              <span className="bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-md">
                <step.icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{step.label}</p>
                <p className="text-muted-foreground text-xs">{step.hint}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
