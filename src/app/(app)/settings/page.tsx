import type { Metadata } from "next";
import { Settings } from "lucide-react";

import { ModulePlaceholder } from "@/components/app-shell/module-placeholder";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <ModulePlaceholder
      icon={Settings}
      title="Settings"
      description="User management, roles & permissions, lookup tables, and notification preferences."
      stage="Stage 1"
    />
  );
}
