"use client";

import { useTransition } from "react";
import { useProgress } from "react-transition-progress";

// Drop-in for useTransition that also drives the global top progress bar: the
// bar starts when the transition starts (a Server Action and/or a router
// navigation) and completes on its own when the transition settles — so it
// covers both "running a function" and "changing the page" with one call.
// startProgress() must run inside the transition (it's an optimistic update),
// which is exactly where we put it.
export function useProgressTransition() {
  const startProgress = useProgress();
  const [isPending, startTransition] = useTransition();

  const start = (action: () => void | Promise<void>) =>
    startTransition(async () => {
      startProgress();
      await action();
    });

  return [isPending, start] as const;
}
