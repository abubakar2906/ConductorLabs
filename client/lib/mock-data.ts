// Single source of mock data for the dashboard.
// Modeled on the PRD data model (Workspace / Release / ReleaseCheck) and the
// PRD "Readiness engine" so it is trivial to swap for real API calls later:
//   - repos/branches      -> GET /api/repos, GET /api/repos/:repo/branches
//   - releases            -> GET /api/releases, GET /api/releases/:id
//   - checks (PR | CI)    -> ReleaseCheck rows; readiness is DERIVED, never stored
//
// Readiness gate (PRD): a release is BLOCKED if any PR targeting the branch is
// still open, OR any CI check is failing/pending. Otherwise READY. Linear is NOT
// part of this gate. The `activity` feed is post-MVP (PRD: "Timeline feed
// post-MVP") and is display-only — it never feeds the readiness computation.

import type { ReleaseStatus } from "@/components/status-pill";

// --- Workspace ---------------------------------------------------------------

export type Workspace = {
  id: string;
  name: string;
};

export const workspace: Workspace = {
  id: "ws_engineering",
  name: "Engineering",
};

// --- Repos & branches (release-creation pickers) -----------------------------

export type Repo = {
  // repo_full_name in the PRD data model, e.g. "acme/conductor-core"
  fullName: string;
  branches: string[];
};

export const repos: Repo[] = [
  { fullName: "acme/conductor-core", branches: ["main", "develop", "release/v3.5"] },
  { fullName: "acme/auth-service", branches: ["main", "fix/token-refresh"] },
  { fullName: "acme/data-ingest", branches: ["main", "feature/v2-schema"] },
  { fullName: "acme/webhooks-gateway", branches: ["main", "staging"] },
];

export function repoShortName(fullName: string): string {
  const slash = fullName.indexOf("/");
  return slash === -1 ? fullName : fullName.slice(slash + 1);
}

// --- Release checks (PRD: ReleaseCheck) --------------------------------------

export type PRStatus = "open" | "merged";
export type CIStatus = "passing" | "failing" | "pending";

export type ReleaseCheck =
  | { id: string; type: "PR"; externalId: string; title: string; status: PRStatus }
  | { id: string; type: "CI"; externalId: string; title: string; status: CIStatus };

// --- Activity (post-MVP timeline; display-only, NOT part of readiness) --------

export type ActivityEvent = {
  actor?: string;
  text: string;
  tag?: string;
  time: string;
  variant?: "default" | "risk";
};

// --- Release (PRD: Release) --------------------------------------------------

export type Release = {
  id: string;
  version: string; // UI label only (e.g. "v3.5"); not in the PRD data model
  name: string;
  repoFullName: string;
  targetBranch: string;
  targetDate: string; // UI label only
  description: string;
  checks: ReleaseCheck[];
  activity: ActivityEvent[];
};

export const releases: Release[] = [
  {
    id: "q3-launch",
    version: "v3.5",
    name: "Q3 Launch Release",
    repoFullName: "acme/conductor-core",
    targetBranch: "main",
    targetDate: "Target Jul 24",
    description:
      "The single source of truth for v3.5. Conductor unifies linked GitHub PRs and CI status into one release state so the team can confidently answer: are we ready to ship?",
    checks: [
      { id: "pr-204", type: "PR", externalId: "204", title: "Render UI before vehicle_state sync", status: "open" },
      { id: "pr-199", type: "PR", externalId: "199", title: "Fix race condition in webhook queue", status: "merged" },
      { id: "ci-build", type: "CI", externalId: "build", title: "build", status: "passing" },
      { id: "ci-e2e", type: "CI", externalId: "e2e-suite", title: "e2e-suite", status: "failing" },
      { id: "ci-sec", type: "CI", externalId: "security-scan", title: "security-scan", status: "passing" },
    ],
    activity: [
      { actor: "karri", text: "opened #1284 Render UI before", tag: "vehicle_state", time: "4min ago" },
      {
        text: "flagged a blocker-ticket CL-488 marked Done but its PR is still Open",
        time: "8min ago",
        variant: "risk",
      },
      { actor: "jori", text: "merged #1279 into", tag: "release/v3.5", time: "22min ago" },
      { text: "passed e2e-suite and security-scan on the release branch", time: "31min ago" },
    ],
  },
  {
    id: "hotfix-3-4-1",
    version: "v3.4.1",
    name: "Hotfix",
    repoFullName: "acme/auth-service",
    targetBranch: "fix/token-refresh",
    targetDate: "Target Jul 18",
    description:
      "Patch release for the token refresh regression reported by the mobile team. Ships as soon as CI is green.",
    checks: [
      { id: "pr-512", type: "PR", externalId: "512", title: "Fix token refresh race", status: "merged" },
      { id: "ci-unit", type: "CI", externalId: "unit", title: "unit", status: "passing" },
      { id: "ci-token", type: "CI", externalId: "token-refresh-tests", title: "token-refresh-tests", status: "failing" },
    ],
    activity: [
      { actor: "aisha", text: "opened #512 fix token refresh race", time: "1h ago" },
      { text: "CI check failed", tag: "token-refresh-tests", time: "2h ago", variant: "risk" },
    ],
  },
  {
    id: "data-pipeline-migration",
    version: "v1.0",
    name: "Data Pipeline Migration",
    repoFullName: "acme/data-ingest",
    targetBranch: "feature/v2-schema",
    targetDate: "Target Aug 02",
    description:
      "Migrates the ingest pipeline to the v2 schema. All checks are green and the branch is ready to merge.",
    checks: [
      { id: "pr-88", type: "PR", externalId: "88", title: "Migrate schema to v2", status: "merged" },
      { id: "ci-build2", type: "CI", externalId: "build", title: "build", status: "passing" },
      { id: "ci-e2e2", type: "CI", externalId: "e2e-suite", title: "e2e-suite", status: "passing" },
    ],
    activity: [
      { actor: "tayyibah", text: "merged #88 migrate schema to v2", time: "3h ago" },
      { text: "passed full test suite on the release branch", time: "3h ago" },
    ],
  },
];

// --- Readiness engine (PRD) --------------------------------------------------

export type BlockingItem = {
  id: string;
  kind: "PR" | "CI";
  ref: string; // "#204" or "e2e-suite"
  label: string; // PR title, or CI check name
  reason: "Open" | "Failing" | "Pending"; // why it blocks
};

export type Readiness = {
  status: ReleaseStatus;
  blockingItems: BlockingItem[];
};

// Rule 1: any open PR targeting the branch -> blocked.
// Rule 2: any failing/pending CI check -> blocked.
export function getReadiness(release: Release): Readiness {
  const blockingItems: BlockingItem[] = [];

  for (const check of release.checks) {
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

export function getRelease(id: string): Release | undefined {
  return releases.find((release) => release.id === id);
}
