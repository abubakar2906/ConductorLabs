"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Search } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { NewReleaseSlideOver } from "@/components/new-release-slideover";
import { fetchReleases, fetchReleaseStatus, type Release } from "@/lib/api";
import { computeReadiness, type Readiness } from "@/lib/readiness";
import { cn, timeAgo } from "@/lib/utils";

type Filter = "all" | "ready" | "running" | "blocked";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "ready", label: "Ready" },
  { key: "running", label: "Running" },
  { key: "blocked", label: "Blocked" },
];

// "owner/name" -> "name"
function repoShort(fullName: string): string {
  const i = fullName.indexOf("/");
  return i === -1 ? fullName : fullName.slice(i + 1);
}

// Per-release live status: still loading, errored, or a computed readiness.
type StatusState = Readiness | "loading" | "error";

function CardStatus({ state }: { state: StatusState | undefined }) {
  if (!state || state === "loading") {
    return <span className="text-xs text-muted-foreground">Checking…</span>;
  }
  if (state === "error") {
    return <span className="text-xs text-muted-foreground">Status unavailable</span>;
  }
  return <StatusPill status={state.status} className="self-start" />;
}

export function ReleasesView() {
  const { getToken } = useAuth();

  // null = still loading the list; [] = loaded but empty.
  const [releases, setReleases] = useState<Release[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, StatusState>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  // Remount key: bump on every open so the wizard always starts fresh.
  const [wizardKey, setWizardKey] = useState(0);

  function openWizard() {
    setWizardKey((k) => k + 1);
    setWizardOpen(true);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const token = await getToken();
        const list = await fetchReleases(token);
        if (!active) return;
        setReleases(list);

        // For each release, ask GitHub live whether it's Ready or Blocked.
        for (const r of list) {
          setStatuses((s) => ({ ...s, [r.id]: "loading" }));
          fetchReleaseStatus(token, r.repo_full_name, r.target_branch)
            .then((res) => {
              if (active)
                setStatuses((s) => ({ ...s, [r.id]: computeReadiness(res.checks) }));
            })
            .catch(() => {
              if (active) setStatuses((s) => ({ ...s, [r.id]: "error" }));
            });
        }
      } catch {
        if (active) setLoadError(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [getToken]);

  const q = query.trim().toLowerCase();
  const visible = (releases ?? []).filter((r) => {
    const st = statuses[r.id];
    if (filter !== "all") {
      // Only include releases whose status has loaded and matches the tab.
      if (!st || st === "loading" || st === "error") return false;
      if (st.status !== filter) return false;
    }
    if (!q) return true;
    return [r.name, r.repo_full_name, repoShort(r.repo_full_name), r.target_branch]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });

  // Tab counts — a release is counted once its status has loaded.
  const counts: Record<Filter, number> = {
    all: releases?.length ?? 0,
    ready: 0,
    running: 0,
    blocked: 0,
  };
  if (releases) {
    for (const r of releases) {
      const st = statuses[r.id];
      if (st && st !== "loading" && st !== "error") counts[st.status] += 1;
    }
  }

  return (
    <>
      <header className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 sm:px-6">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search releases, repos, branches..."
            className="w-full rounded-lg border border-border bg-card py-2 pr-3 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-foreground/20"
          />
        </div>
      </header>

      <main className="flex-1 px-4 py-8 sm:px-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Releases</h1>
            <p className="mt-1 text-sm text-muted-foreground">Engineering v1.0 Workspace</p>
          </div>
          <button
            type="button"
            onClick={openWizard}
            className="shrink-0 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 active:translate-y-px"
          >
            New Release
          </button>
        </div>

        {loadError ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Couldn&apos;t load your releases. Is the server running?
          </p>
        ) : releases === null ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Loading releases…</p>
        ) : releases.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-20 text-center">
            <p className="text-sm text-muted-foreground">
              No releases yet. Create one to start tracking readiness.
            </p>
            <button
              type="button"
              onClick={openWizard}
              className="mt-5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 active:translate-y-px"
            >
              New Release
            </button>
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center gap-1 border-b border-border font-mono text-xs uppercase tracking-wide">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  aria-current={filter === f.key ? "true" : undefined}
                  className={cn(
                    "-mb-px border-b-2 px-2 pb-2.5 transition-colors focus-visible:outline-none",
                    filter === f.key
                      ? "border-foreground text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f.label}
                  <span
                    className={cn(
                      "ml-1.5 rounded-full px-1.5 py-px text-[10px] tabular-nums",
                      filter === f.key ? "bg-foreground/10 opacity-100" : "opacity-60",
                    )}
                  >
                    {counts[f.key]}
                  </span>
                </button>
              ))}
            </div>

            {visible.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                {q ? "No releases match your search." : `No ${filter} releases.`}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visible.map((r) => (
                  <Link
                    key={r.id}
                    href={`/releases/${r.id}`}
                    className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-muted-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-card-foreground">{r.name}</p>
                        <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                          {repoShort(r.repo_full_name)} / {r.target_branch}
                        </p>
                      </div>
                      <CardStatus state={statuses[r.id]} />
                    </div>
                    {(() => {
                      const st = statuses[r.id];
                      if (!st || st === "loading" || st === "error") return null;
                      const top = (
                        st.status === "blocked"
                          ? st.blockingItems
                          : st.runningItems
                      ).slice(0, 2);
                      return (
                        <div className="flex flex-col gap-1.5 border-t border-border/60 pt-3">
                          <p className="truncate text-xs text-muted-foreground">{st.why}</p>
                          {top.length > 0 && (
                            <ul className="flex flex-col gap-0.5">
                              {top.map((item) => (
                                <li
                                  key={item.id}
                                  className="truncate font-mono text-xs text-foreground/80"
                                >
                                  {item.ref}
                                  {item.label ? ` — ${item.label}` : ""}
                                  {item.reason ? (
                                    <span className="text-muted-foreground"> · {item.reason.toLowerCase()}</span>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          )}
                          {r.last_push_at ? (
                            <p className="text-[11px] text-muted-foreground/80">
                              Last push {timeAgo(r.last_push_at)}
                            </p>
                          ) : null}
                        </div>
                      );
                    })()}
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {wizardOpen && (
        <NewReleaseSlideOver key={wizardKey} onClose={() => setWizardOpen(false)} />
      )}
    </>
  );
}
