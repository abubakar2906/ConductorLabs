// The Ready/Blocked engine — now working on a plain list of checks, so it runs
// on REAL data from the server exactly the same way it ran on mock data.
//
// The rules (unchanged): a release is BLOCKED if any PR targeting the branch is
// still open, OR any CI check is failing/pending. Otherwise READY.

import type { ReleaseStatus } from "@/components/status-pill";

export type ReleaseCheck =
  | { id: string; type: "PR"; externalId: string; title: string; status: "open" | "merged" }
  | { id: string; type: "CI"; externalId: string; title: string; status: "passing" | "failing" | "pending" };

export type BlockingItem = {
  id: string;
  kind: "PR" | "CI";
  ref: string; // "#204" for a PR, or the check name for CI
  label: string; // PR title (CI has none — the ref already names it)
  reason: "Open" | "Failing" | "Pending";
};

export type Readiness = {
  status: ReleaseStatus;
  blockingItems: BlockingItem[];
};

export function computeReadiness(checks: ReleaseCheck[]): Readiness {
  const blockingItems: BlockingItem[] = [];

  for (const check of checks) {
    if (check.type === "PR" && check.status === "open") {
      blockingItems.push({
        id: check.id,
        kind: "PR",
        ref: `#${check.externalId}`,
        label: check.title,
        reason: "Open",
      });
    }
    if (check.type === "CI" && check.status !== "passing") {
      blockingItems.push({
        id: check.id,
        kind: "CI",
        ref: check.title,
        label: "",
        reason: check.status === "failing" ? "Failing" : "Pending",
      });
    }
  }

  return {
    status: blockingItems.length === 0 ? "ready" : "blocked",
    blockingItems,
  };
}
