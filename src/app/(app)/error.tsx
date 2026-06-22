"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Designed error boundary for the authenticated shell. Logs the error (with its
// digest) and offers recovery — never a raw stack to the user.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] route error", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center text-center">
      <span className="bg-destructive/10 text-destructive mb-5 flex size-14 items-center justify-center rounded-2xl">
        <TriangleAlert className="size-7" />
      </span>
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="text-muted-foreground mt-2 max-w-md text-balance">
        An unexpected error stopped this page from loading. Try again, or head back to your
        dashboard.
      </p>
      <div className="mt-6 flex items-center gap-2">
        <Button size="lg" onClick={reset}>
          Try again
        </Button>
        <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
