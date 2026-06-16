import type { Metadata } from "next";
import { Wallet } from "lucide-react";

import { ModulePlaceholder } from "@/components/app-shell/module-placeholder";

export const metadata: Metadata = { title: "Finance" };

export default function FinancePage() {
  return (
    <ModulePlaceholder
      icon={Wallet}
      title="Finance"
      description="Budget vs. actual, expenses with approvals, and cash flow — one approvals inbox across the whole system."
      stage="Stage 4"
    />
  );
}
