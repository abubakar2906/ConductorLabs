"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { StatusPill } from "@/components/status-pill";
import { workspace } from "@/lib/mock-data";
import { fetchGithubStatus, type GithubStatus } from "@/lib/api";

function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export function SettingsView() {
  const { getToken } = useAuth();
  const [name, setName] = useState(workspace.name);

  // Real GitHub connection status, fetched from our server on page load.
  // null = still loading; then either the real data or an error flag.
  const [github, setGithub] = useState<GithubStatus | null>(null);
  const [githubError, setGithubError] = useState(false);

  useEffect(() => {
    let active = true; // guard against setting state after the page unmounts
    (async () => {
      try {
        const token = await getToken();
        const status = await fetchGithubStatus(token);
        if (active) setGithub(status);
      } catch {
        if (active) setGithubError(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [getToken]);

  return (
    <main className="flex-1 px-4 py-8 sm:px-8">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">{workspace.name} v1.0 Workspace</p>

      <div className="mt-8 flex max-w-2xl flex-col gap-4">
        {/* GitHub connection — real status from the server */}
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
                <GithubMark className="size-4.5 text-foreground" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-medium text-card-foreground">GitHub</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {githubError
                    ? "Couldn't reach the server"
                    : github === null
                      ? "Checking connection…"
                      : github.connected ? (
                          <>
                            Connected as{" "}
                            <span className="font-mono text-foreground">
                              @{github.username}
                            </span>
                          </>
                        ) : (
                          "Not connected"
                        )}
                </p>
              </div>
            </div>
            {github?.connected && <StatusPill status="ready" className="shrink-0" />}
          </div>
        </section>

        {/* Workspace name */}
        <section className="rounded-xl border border-border bg-card p-5">
          <label htmlFor="workspace-name" className="text-sm font-medium text-card-foreground">
            Workspace name
          </label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Shown across the dashboard and in the workspace switcher.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <input
              id="workspace-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full max-w-xs rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
            <button
              type="button"
              disabled={name.trim() === "" || name === workspace.name}
              className="rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 active:translate-y-px disabled:pointer-events-none disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
