import type { Metadata } from "next";
import { FileBarChart } from "lucide-react";

import { ModulePlaceholder } from "@/components/app-shell/module-placeholder";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage() {
  return (
    <ModulePlaceholder
      icon={FileBarChart}
      title="Reports"
      description="The full report catalog with PDF / Excel / CSV export, plus the role-aware management dashboard."
      stage="Stage 5"
    />
  );
}
