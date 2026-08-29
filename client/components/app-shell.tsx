"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { ConductorLogo } from "@/components/conductor-logo";
import { cn } from "@/lib/utils";

// Fixed-height app shell. On md+ the sidebar is static; below md it collapses
// behind a hamburger and slides in as a drawer over a dimmed backdrop.
export function AppShell({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      <div
        className={cn("fixed inset-0 z-40 md:hidden", navOpen ? "" : "pointer-events-none")}
        aria-hidden={!navOpen}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-label="Close menu"
          onClick={() => setNavOpen(false)}
          className={cn(
            "absolute inset-0 cursor-default bg-black/50 transition-opacity duration-200",
            navOpen ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          className={cn(
            "absolute inset-y-0 left-0 transition-transform duration-300 ease-out",
            navOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <Sidebar onNavigate={() => setNavOpen(false)} />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {/* Mobile top bar */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 active:translate-y-px"
          >
            <Menu className="size-5" />
          </button>
          <div className="flex items-center gap-2">
            <ConductorLogo className="size-5" />
            <span className="text-sm font-semibold">
              Conductor<span className="font-normal text-muted-foreground">Labs</span>
            </span>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
