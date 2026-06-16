import type { LucideIcon } from "lucide-react";

// Designed empty state for modules that arrive in a later stage — no bare
// "Coming soon" string (firm rule: every empty state is designed).
export function ModulePlaceholder({
  icon: Icon,
  title,
  description,
  stage,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  stage: string;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center text-center">
      <span className="bg-primary/10 text-primary mb-5 flex size-14 items-center justify-center rounded-2xl">
        <Icon className="size-7" />
      </span>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground mt-2 max-w-md text-balance">{description}</p>
      <span className="text-muted-foreground mt-6 rounded-full border px-3 py-1 text-xs font-medium">
        Arrives in {stage}
      </span>
    </div>
  );
}
