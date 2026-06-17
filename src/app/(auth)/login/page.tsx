import { Suspense } from "react";
import { redirect } from "next/navigation";

import { getSession, isAuthorized } from "@/lib/session";

import { LoginForm } from "./login-form";

// The session read is dynamic (cookies), so under Cache Components it must live
// inside <Suspense>. The gate runs the AUTHORITATIVE check (it can read the DB),
// unlike the optimistic proxy, and shares the AuthGate's `isAuthorized` predicate
// so the two can never disagree and loop. The form is only rendered once we've
// confirmed the visitor is NOT signed in — so a signed-in user is redirected
// without ever seeing the form.
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="bg-background min-h-svh" />}>
      <LoginGate />
    </Suspense>
  );
}

async function LoginGate() {
  const session = await getSession();
  if (isAuthorized(session)) {
    redirect("/dashboard");
  }

  return <LoginForm />;
}
