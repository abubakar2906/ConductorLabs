"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { ArrowLeft, CircleAlert, GitBranch, GitPullRequest } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { fetchRelease, fetchReleaseStatus, type Release } from "@/lib/api";
import { computeReadiness, type BlockingItem, type Readiness } from "@/lib/readiness";

function repoShort(fullName: string): string {
  const i = fullName.indexOf("/");
  return i === -1 ? fullName : fullName.slice(i + 1);
}

function BlockingRow({ item }: { item: BlockingItem }) {
  const Icon = item.kind === "PR" ? GitPullRequest : CircleAlert;
  return (
    <li className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-warning/10">
          <Icon className="size-3 text-warning" />
        </span>
        <span className="min-w-0 truncate text-sm text-card-foreground">
          <span className="font-mono text-muted-foreground">{item.ref}</span>
          {item.label && ` ${item.label}`}
        </span>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-warning/10 px-2.5 py-0.5 font-mono text-xs font-medium text-warning">
        {item.reason}
      </span>
    </li>
  );
}

export default function ReleaseDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { getToken } = useAuth();

  const [release, setRelease] = useState<Release | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [statusError, setStatusError] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const token = await getToken();
        const rel = await fetchRelease(token, id);
        if (!active) return;
        setRelease(rel);

        // Release loaded — now ask GitHub live whether it's Ready or Blocked.
        try {
          const res = await fetchReleaseStatus(token, rel.repo_full_name, rel.target_branch);
          if (active) setReadiness(computeReadiness(res.checks));
        } catch {
          if (active) setStatusError(true);
        }
      } catch {
        if (active) setNotFound(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, getToken]);

  return (
    <>
      <header className="flex items-center border-b border-border px-4 py-3 sm:px-6">
        <Link
          href="/releases"
          className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
        >
          <ArrowLeft className="size-4 shrink-0" />
          Releases
        </Link>
      </header>

      <main className="flex-1 px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-3xl">
          {notFound ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Release not found.
            </p>
          ) : release === null ? (
            <p className="py-16 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              <div className="mb-4 flex items-center gap-2">
                {readiness && <StatusPill status={readiness.status} />}
              </div>

              <h1 className="text-2xl font-semibold tracking-tight">{release.name}</h1>
              <p className="mt-2 flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                <GitBranch className="size-3.5" />
                {repoShort(release.repo_full_name)} / {release.target_branch}
              </p>

              <div className="mt-6 rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-medium text-card-foreground">Status</h2>
                  {readiness ? (
                    <StatusPill status={readiness.status} />
                  ) : statusError ? (
                    <span className="text-xs text-muted-foreground">Unavailable</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Checking…</span>
                  )}
                </div>

                {statusError && (
                  <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
                    Couldn&apos;t reach GitHub for this repo. Check the repo name and that
                    your GitHub connection can see it.
                  </p>
                )}

                {readiness?.status === "blocked" && readiness.blockingItems.length > 0 && (
                  <div className="mt-5 border-t border-border pt-4">
                    <h3 className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
                      Blocking Items
                    </h3>
                    <ul className="flex flex-col gap-2.5">
                      {readiness.blockingItems.map((item) => (
                        <BlockingRow key={item.id} item={item} />
                      ))}
                    </ul>
                  </div>
                )}

                {readiness?.status === "ready" && (
                  <p className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
                    No open PRs and all CI checks passing on{" "}
                    <span className="font-mono text-foreground">{release.target_branch}</span>.
                    Safe to ship.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
