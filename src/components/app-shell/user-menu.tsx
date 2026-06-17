"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, Moon, Sun, UserRound } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";

import { useProgressTransition } from "@/hooks/use-progress-transition";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth-client";

import { AccountDialog } from "./account-dialog";

export function UserMenu({
  name,
  email,
  role,
  initials,
}: {
  name: string;
  email: string;
  role: string | null;
  initials: string;
}) {
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
  const [isPending, startTransition] = useProgressTransition();
  const [accountOpen, setAccountOpen] = useState(false);

  function onSignOut() {
    startTransition(async () => {
      const { error } = await signOut();
      if (error) {
        toast.error("Couldn't sign out. Please try again.");
        return;
      }
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label="Account menu"
              className="focus-visible:ring-ring rounded-full focus-visible:ring-2 focus-visible:outline-none"
            />
          }
        >
          <Avatar className="size-8 border">
            <AvatarFallback className="text-[11px] font-medium">{initials}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-1.5 py-1.5">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="text-muted-foreground truncate text-xs">{email}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setAccountOpen(true)}>
            <UserRound />
            Account
          </DropdownMenuItem>
          <DropdownMenuItem
            closeOnClick={false}
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          >
            <Sun className="dark:hidden" />
            <Moon className="hidden dark:block" />
            Toggle theme
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault();
              onSignOut();
            }}
          >
            {isPending ? <Loader2 className="animate-spin" /> : <LogOut />}
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AccountDialog
        open={accountOpen}
        onOpenChange={setAccountOpen}
        name={name}
        email={email}
        role={role}
        initials={initials}
      />
    </>
  );
}
