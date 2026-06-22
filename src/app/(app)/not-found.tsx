import Link from "next/link";
import { FileQuestion } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Designed 404 for the authenticated shell. Also where a project-scope miss lands:
// a guessed/forbidden project id calls notFound(), and the copy is deliberately
// ambiguous (doesn't-exist vs no-access) so it can't confirm a record's existence.
export default function AppNotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center text-center">
      <span className="bg-primary/10 text-primary mb-5 flex size-14 items-center justify-center rounded-2xl">
        <FileQuestion className="size-7" />
      </span>
      <h1 className="text-2xl font-semibold tracking-tight">Not found</h1>
      <p className="text-muted-foreground mt-2 max-w-md text-balance">
        This page doesn&rsquo;t exist, or you don&rsquo;t have access to it. If you followed a link
        to a project, ask an admin to add you to its team.
      </p>
      <Link href="/dashboard" className={cn(buttonVariants({ size: "lg" }), "mt-6")}>
        Back to dashboard
      </Link>
    </div>
  );
}
