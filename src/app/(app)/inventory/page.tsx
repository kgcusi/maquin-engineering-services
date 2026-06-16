import type { Metadata } from "next";
import { Boxes } from "lucide-react";

import { ModulePlaceholder } from "@/components/app-shell/module-placeholder";

export const metadata: Metadata = { title: "Inventory" };

export default function InventoryPage() {
  return (
    <ModulePlaceholder
      icon={Boxes}
      title="Inventory"
      description="The append-only stock ledger — stock-in, requests, releases, site receiving, and full material traceability."
      stage="Stage 3"
    />
  );
}
