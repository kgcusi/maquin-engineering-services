import type { Metadata } from "next";
import { FolderKanban } from "lucide-react";

import { ModulePlaceholder } from "@/components/app-shell/module-placeholder";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <ModulePlaceholder
      icon={FolderKanban}
      title="Projects"
      description="Project tracking, phases & tasks, and daily site reports — with engineers scoped to their assigned sites."
      stage="Stage 2"
    />
  );
}
