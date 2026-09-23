// Ready / Running / Blocked engine — operates on a plain list of checks so
// it runs on REAL data from the server exactly the same way it ran on mock data.
//
// Rules:
//   BLOCKED  — an open PR targets the branch, OR any CI check is failing.
//   RUNNING  — nothing is failing, no open PRs, but at least one CI check
//              is pending / queued / in-progress (tests in flight).
//   READY    — everything passing, no open PRs, no pending CI.

import type { ReleaseStatus } from "@/components/status-pill";

export type ReleaseCheck =
  | {
      id: string;
      type: "PR";
      externalId: string;
      title: string;
      status: "open" | "merged";
      url?: string | null;
      author?: string | null;
      createdAt?: string | null;
    }
  | {
      id: string;
      type: "CI";
      externalId: string;
      title: string;
      status: "passing" | "failing" | "pending";
      url?: string | null;
      queued?: boolean;
      startedAt?: string | null;
      completedAt?: string | null;
    };

export type BranchTip = {
  sha: string;
  shortSha: string;
  message: string;
  author?: string | null;
  committedAt?: string | null;
  url?: string | null;
};

export type BlockingItem = {
  id: string;
  kind: "PR" | "CI";
  ref: string;
  label: string;
  reason: "Open" | "Failing" | "Pending";
  url?: string | null;
  author?: string | null;
};

export type RunningItem = {
  id: string;
  kind: "PR" | "CI";
  ref: string;
  label: string;
  reason: string;
  startedAt?: string | null;
  author?: string | null;
  url?: string | null;
};

export type Readiness = {
  status: ReleaseStatus;
  blockingItems: BlockingItem[];
  runningItems: RunningItem[];
  why: string;
};

export function computeReadiness(checks: ReleaseCheck[]): Readiness {
  const blockingItems: BlockingItem[] = [];
  const runningItems: RunningItem[] = [];

  for (const check of checks) {
    if (check.type === "PR" && check.status === "open") {
      blockingItems.push({
        id: check.id,
        kind: "PR",
        ref: `#${check.externalId}`,
        label: check.title,
        reason: "Open",
        url: check.url ?? null,
        author: check.author ?? null,
      });
    }
    if (check.type === "CI" && check.status === "failing") {
      blockingItems.push({
        id: check.id,
        kind: "CI",
        ref: check.title,
        label: "",
        reason: "Failing",
        url: check.url ?? null,
      });
    }
    if (check.type === "CI" && (check.status === "pending" || check.queued)) {
      runningItems.push({
        id: check.id,
        kind: "CI",
        ref: check.title,
        label: "",
        reason: check.queued ? "Queued" : "In progress",
        startedAt: check.startedAt ?? null,
        url: check.url ?? null,
      });
    }
    // Passing CI and merged PRs need no action here — they only matter
    // indirectly: with nothing open/failing/pending, the release is READY.
  }

  // Determine status: blocked > running > ready
  let status: ReleaseStatus;
  if (blockingItems.length > 0) {
    status = "blocked";
  } else if (runningItems.length > 0) {
    status = "running";
  } else {
    status = "ready";
  }

  // Build a human-readable "why" one-liner
  const why = buildWhy(status, blockingItems, runningItems);

  return { status, blockingItems, runningItems, why };
}

function buildWhy(
  status: ReleaseStatus,
  blocking: BlockingItem[],
  running: RunningItem[],
): string {
  if (status === "blocked") {
    const prBlockers = blocking.filter((b) => b.kind === "PR");
    const ciBlockers = blocking.filter((b) => b.kind === "CI");
    const parts: string[] = [];
    if (prBlockers.length > 0) {
      parts.push(
        prBlockers.length === 1
          ? `${prBlockers[0].ref} is open`
          : `${prBlockers.length} open PRs`,
      );
    }
    if (ciBlockers.length > 0) {
      parts.push(
        ciBlockers.length === 1
          ? `${ciBlockers[0].ref} is failing`
          : `${ciBlockers.length} CI checks failing`,
      );
    }
    return `Blocked — ${parts.join(" and ")}`;
  }
  if (status === "running") {
    return `Running — ${running.length === 1 ? "1 check in flight" : `${running.length} checks in flight`}`;
  }
  return "Ready to ship";
}
