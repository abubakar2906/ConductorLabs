"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { Check, ChevronsUpDown, ListChecks, LogOut, Settings } from "lucide-react";
import { ConductorLogo } from "@/components/conductor-logo";
import { cn } from "@/lib/utils";
import { workspace } from "@/lib/mock-data";

const navItems = [
  { label: "Releases", href: "/releases", icon: ListChecks },
  { label: "Settings", href: "/settings", icon: Settings },
];

function WorkspaceSwitcher() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative px-2 py-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 active:translate-y-px"
      >
        <ConductorLogo className="size-5 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
          Conductor<span className="font-normal text-muted-foreground">Labs</span>
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div
            role="menu"
            className="absolute top-full right-2 left-2 z-20 mt-1 overflow-hidden rounded-lg border border-border bg-card p-1 shadow-xl shadow-black/40"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-secondary"
            >
              <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-secondary text-[10px] font-semibold text-secondary-foreground">
                {workspace.name.charAt(0)}
              </span>
              <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
              <Check className="size-3.5 shrink-0 text-success" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { signOut } = useClerk();
  const { user } = useUser();

  // Show the real person: GitHub handle first, then Clerk username, then the
  // login email as a last resort. (Real names come later, with onboarding.)
  const githubAccount = user?.externalAccounts?.find(
    (a) => a.provider === "github",
  );
  const email = user?.primaryEmailAddress?.emailAddress;
  const handle = githubAccount?.username ?? user?.username ?? email ?? "Account";
  const initial = handle.charAt(0).toUpperCase();

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-sidebar md:w-52">
      <WorkspaceSwitcher />

      <nav className="flex flex-col gap-0.5 px-2 py-2">
        {navItems.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20",
                active
                  ? "bg-secondary font-medium text-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <item.icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={() => signOut({ redirectUrl: "/sign-in" })}
        className="mt-auto flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground/20"
      >
        <LogOut className="size-4 shrink-0" />
        Sign out
      </button>

      <Link
        href="/settings"
        onClick={onNavigate}
        className="flex items-center gap-2.5 border-t border-border px-3 py-3 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground/20"
      >
        {user?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.imageUrl}
            alt=""
            className="size-7 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-medium text-secondary-foreground">
            {initial}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{handle}</p>
          {email && email !== handle && (
            <p className="truncate font-mono text-[11px] text-muted-foreground">{email}</p>
          )}
        </div>
      </Link>
    </aside>
  );
}
