import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/datetime";
import type { ProjectDetail } from "@/modules/projects/queries";

function fmtDate(iso: string | null, timeZone: string): string | null {
  if (!iso) return null;
  return formatDateTime(`${iso}T00:00:00`, timeZone, "date");
}

function Field({
  label,
  value,
  className,
}: {
  label: string;
  value: string | null;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5 text-sm">
        {value?.trim() ? value : <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  );
}

export function ProjectDetailsPanel({
  project,
  currency,
  timeZone,
}: {
  project: ProjectDetail;
  currency: string;
  timeZone: string;
}): ReactNode {
  const contract = project.contractAmount ? formatCurrency(project.contractAmount, currency) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Details</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label="Location" value={project.location} />
          <Field label="Contract amount" value={contract} />
          <Field label="Start date" value={fmtDate(project.startDate, timeZone)} />
          <Field label="Target end date" value={fmtDate(project.targetEndDate, timeZone)} />
          <Field label="Actual end date" value={fmtDate(project.actualEndDate, timeZone)} />
          <Field
            label="Defects liability until"
            value={fmtDate(project.defectsLiabilityUntil, timeZone)}
          />
          <Field label="Scope of work" value={project.scopeOfWork} className="sm:col-span-2" />
        </dl>
      </CardContent>
    </Card>
  );
}
