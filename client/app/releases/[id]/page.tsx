"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  ArrowLeft,
  CircleAlert,
  Clock,
  ExternalLink,
  GitBranch,
  GitCommit,
  GitPullRequest,
  Loader2,
  Trash2,
} from "lucide-react";
import { ReleaseNotesCard } from "@/components/release-notes-card";
import { StatusPill } from "@/components/status-pill";
import {
  deleteRelease,
  fetchRelease,
  fetchReleaseStatus,
  type BranchTip,
  type Release,
} from "@/lib/api";
import {
  computeReadiness,
  type BlockingItem,
  type Readiness,
  type RunningItem,
} from "@/lib/readiness";
import { cn, elapsedSince, timeAgo } from "@/lib/utils";

function repoShort(fullName: string): string {
  const i = fullName.indexOf("/");
  return i === -1 ? fullName : fullName.slice(i + 1);
}

function BlockingRow({ item }: { item: BlockingItem }) {
  const Icon = item.kind === "PR" ? GitPullRequest : CircleAlert;
  const row = (
    <li className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-warning/10">
          <Icon className="size-3 text-warning" />
        </span>
        <span className="min-w-0 truncate text-sm text-card-foreground">
          <span className="font-mono text-muted-foreground">{item.ref}</span>
          {item.label && ` ${item.label}`}
          {item.author && (
            <span className="text-muted-foreground"> · {item.author}</span>
          )}
        </span>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-warning/10 px-2.5 py-0.5 font-mono text-xs font-medium text-warning">
        {item.reason}
      </span>
    </li>
  );

  if (item.url) {
    return (
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        className="group/row block rounded-md transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
      >
        {row}
      </a>
    );
  }
  return row;
}

function RunningRow({ item }: { item: RunningItem }) {
  const inFlight = item.reason === "In progress";
  const Icon = inFlight ? Loader2 : Clock;
  const elapsed = elapsedSince(item.startedAt);
  return (
    <li className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-running/10">
          <Icon
            className={inFlight ? "size-3 animate-spin text-running" : "size-3 text-running"}
          />
        </span>
        <span className="min-w-0 truncate text-sm text-card-foreground">
          <span className="font-mono text-muted-foreground">{item.ref}</span>
          {item.author && (
            <span className="text-muted-foreground"> · {item.author}</span>
          )}
        </span>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-running/10 px-2.5 py-0.5 font-mono text-xs font-medium text-running">
        {item.reason}
        {inFlight && elapsed && ` · ${elapsed}`}
      </span>
    </li>
  );
}

function BranchTipCard({ tip }: { tip: BranchTip }) {
  return (
    <div className="mt-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <GitCommit className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-medium text-card-foreground">Branch tip</h2>
      </div>
      <p className="mt-3 flex items-center gap-2 text-sm text-card-foreground">
        {tip.url ? (
          <a
            href={tip.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded font-mono text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
          >
            {tip.shortSha}
            <ExternalLink className="size-3" />
          </a>
        ) : (
          <span className="font-mono text-muted-foreground">{tip.shortSha}</span>
        )}
        <span className="min-w-0 truncate text-muted-foreground">
          {tip.message || "No commit message"}
        </span>
      </p>
      {(tip.author || tip.committedAt) && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {tip.author && <span>{tip.author}</span>}
          {tip.author && tip.committedAt && <span> · </span>}
          {tip.committedAt && <span>{timeAgo(tip.committedAt)}</span>}
        </p>
      )}
    </div>
  );
}

export default function ReleaseDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { getToken } = useAuth();

  const [release, setRelease] = useState<Release | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [branchTip, setBranchTip] = useState<BranchTip | null>(null);
  const [statusError, setStatusError] = useState(false);

  // Two-step delete: first click arms the button, second click fires the API.
  // Armed state auto-cancels after 5s so a stray second tap can't delete later.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!confirmingDelete) return;
    const t = setTimeout(() => setConfirmingDelete(false), 5000);
    return () => clearTimeout(t);
  }, [confirmingDelete]);

  async function handleDelete() {
    if (deleting) return;
    if (!confirmingDelete) {
      setDeleteError(null);
      setConfirmingDelete(true);
      return;
    }
    try {
      const token = await getToken();
      setDeleting(true);
      await deleteRelease(token, id);
      setConfirmingDelete(false);
      router.push("/releases");
    } catch {
      setDeleting(false);
      setConfirmingDelete(false);
      setDeleteError("Couldn't delete this release. Try again.");
    }
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const token = await getToken();
        const rel = await fetchRelease(token, id);
        if (!active) return;
        setRelease(rel);

        // Release loaded — now ask GitHub live whether it's Ready, Running,
        // or Blocked, plus what the branch tip looks like.
        try {
          const res = await fetchReleaseStatus(
            token,
            rel.repo_full_name,
            rel.target_branch,
          );
          if (!active) return;
          setReadiness(computeReadiness(res.checks));
          setBranchTip(res.branchTip ?? null);
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
            <p className="py-16 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          ) : (
            <>
              <div className="mb-4 flex min-w-0 items-center gap-2">
                {readiness && <StatusPill status={readiness.status} />}
                {readiness && (
                  <span className="min-w-0 truncate text-sm text-muted-foreground">
                    {readiness.why}
                  </span>
                )}
              </div>

              <h1 className="text-2xl font-semibold tracking-tight">
                {release.name}
              </h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-xs text-muted-foreground">
                <GitBranch className="size-3.5" />
                {repoShort(release.repo_full_name)} / {release.target_branch}
                {release.last_push_at && (
                  <span className="flex items-center gap-1">
                    · last push {timeAgo(release.last_push_at)}
                  </span>
                )}
              </p>

              <div className="mt-6 rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-medium text-card-foreground">
                    Status
                  </h2>
                  {readiness ? (
                    <StatusPill status={readiness.status} />
                  ) : statusError ? (
                    <span className="text-xs text-muted-foreground">
                      Unavailable
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Checking…
                    </span>
                  )}
                </div>

                {statusError && (
                  <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
                    Couldn&apos;t reach GitHub for this repo. Check the repo
                    name and that your GitHub connection can see it.
                  </p>
                )}

                {readiness?.status === "running" &&
                  readiness.runningItems.length > 0 && (
                    <div className="mt-5 border-t border-border pt-4">
                      <h3 className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
                        In progress
                      </h3>
                      <ul className="flex flex-col gap-2.5">
                        {readiness.runningItems.map((item) => (
                          <RunningRow key={item.id} item={item} />
                        ))}
                      </ul>
                    </div>
                  )}

                {readiness?.status === "blocked" &&
                  readiness.blockingItems.length > 0 && (
                    <div className="mt-5 border-t border-border pt-4">
                      <h3 className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
                        Blocking items
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
                    <span className="font-mono text-foreground">
                      {release.target_branch}
                    </span>
                    . Safe to ship.
                  </p>
                )}

                <div className="mt-5 border-t border-border pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-medium text-card-foreground">Delete release</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Removes this saved release. Nothing on GitHub is changed.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => (confirmingDelete ? void handleDelete() : setConfirmingDelete(true))}
                      disabled={deleting}
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 disabled:pointer-events-none disabled:opacity-60",
                        confirmingDelete
                          ? "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
                          : "border-border bg-transparent text-muted-foreground hover:border-destructive/40 hover:text-destructive",
                      )}
                    >
                      {deleting ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          Deleting…
                        </>
                      ) : confirmingDelete ? (
                        "Confirm delete"
                      ) : (
                        <>
                          <Trash2 className="size-3.5" />
                          Delete release
                        </>
                      )}
                    </button>
                  </div>
                  {deleteError && (
                    <p className="mt-3 text-xs text-destructive">{deleteError}</p>
                  )}
                </div>
              </div>

              {branchTip && (
                <BranchTipCard tip={branchTip} />
              )}

              <ReleaseNotesCard release={release} onChange={setRelease} />
            </>
          )}
        </div>
      </main>
    </>
  );
}