"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, HardHat, Loader2, Lock, Mail } from "lucide-react";
import { toast } from "sonner";

import { signIn } from "@/lib/auth-client";
import { BrandPanel } from "@/components/auth/brand-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    // useTransition keeps the submit button disabled while the request is in
    // flight — a spammed click can't fire twice (firm form-submission rule).
    startTransition(async () => {
      const { error: signInError } = await signIn.email({ email, password });

      if (signInError) {
        const message = signInError.message ?? "Unable to sign in. Check your credentials.";
        setError(message);
        toast.error(message);
        return;
      }

      toast.success("Welcome!");
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-[1.05fr_1fr] xl:grid-cols-2">
      <BrandPanel />

      <main className="flex flex-col px-6 py-10 sm:px-10">
        {/* Compact brand mark for when the panel is hidden (mobile/tablet). */}
        <div className="flex items-center gap-2.5 lg:hidden">
          <span className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-lg">
            <HardHat className="size-4" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold">MAQUIN Engineering Services</p>
            <p className="text-muted-foreground text-[11px]">Operations Console</p>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
            <div className="space-y-1.5">
              <h2 className="text-2xl font-semibold tracking-tight">Welcome!</h2>
              <p className="text-muted-foreground text-sm">
                Sign in to continue to your dashboard.
              </p>
            </div>

            <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="you@firm.com"
                    className="pl-9"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={isPending}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    className="pr-10 pl-9"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={isPending}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((shown) => !shown)}
                    disabled={isPending}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md transition-colors disabled:opacity-50"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {error ? (
                <p role="alert" className="text-destructive text-sm">
                  {error}
                </p>
              ) : null}

              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>

            <p className="text-muted-foreground mt-6 text-center text-xs text-balance">
              Accounts are provisioned by an administrator. Forgot your password? Contact your
              admin.
            </p>
          </div>
        </div>

        <p className="text-muted-foreground/70 hidden text-xs lg:block">
          © 2026 PMTIS · Internal use only
        </p>
      </main>
    </div>
  );
}
