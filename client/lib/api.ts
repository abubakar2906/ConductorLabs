// The phone line to the NestJS "back office".
//
// Every real request to our server has to prove who's asking, so each call
// attaches the current user's Clerk token in the `Authorization` header —
// exactly what the server's ClerkGuard checks. The token is fetched on the
// client via Clerk's `getToken()` and passed into these helpers.

import type { BranchTip, ReleaseCheck } from "@/lib/readiness";
export type { BranchTip, ReleaseCheck } from "@/lib/readiness";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// Small wrapper around fetch that points at our API and attaches the token.
async function apiGet<T>(path: string, token: string | null): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error(`API ${path} responded ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// Same idea, for sending data (POST) with a JSON body.
async function apiPost<T>(path: string, token: string | null, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`API ${path} responded ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// --- GitHub connection status (Settings card) --------------------------------

export type GithubStatus = {
  connected: boolean;
  username?: string;
  scopes?: string[];
};

export function fetchGithubStatus(token: string | null): Promise<GithubStatus> {
  return apiGet<GithubStatus>("/auth/github/status", token);
}

// --- Releases (saved in the database) ----------------------------------------

// One release row as it comes back from the server (snake_case, from Postgres).
export type Release = {
  id: string;
  name: string;
  repo_full_name: string;
  target_branch: string;
  created_at: string;
  // Set by the GitHub webhook on each push to target_branch; null for older rows.
  last_push_at: string | null;
  // AI-written release notes (Markdown) and the metadata around it.
  release_notes: string | null;
  notes_generated_at: string | null;
  notes_edited: boolean;
  notes_tip_sha: string | null;
};

// What POST /releases/:id/release-notes answers with — the server's
// GenerateResult: the updated release row, whether it was served from the
// tip cache, and how many commits the fresh generation was based on.
export type GenerateNotesResponse = {
  release: Release;
  cached: boolean;
  commitCount: number;
};

export function fetchReleases(token: string | null): Promise<Release[]> {
  return apiGet<Release[]>("/releases", token);
}

export function fetchRelease(token: string | null, id: string): Promise<Release> {
  return apiGet<Release>(`/releases/${id}`, token);
}

export function createRelease(
  token: string | null,
  input: { name: string; repoFullName: string; targetBranch: string },
): Promise<Release> {
  return apiPost<Release>("/releases", token, input);
}

// Same wrapper for DELETE — no body, just the path, and the deleted row comes back.
async function apiDelete<T>(path: string, token: string | null): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error(`API ${path} responded ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function deleteRelease(token: string | null, id: string): Promise<Release> {
  return apiDelete<Release>(`/releases/${id}`, token);
}

// --- AI release notes --------------------------------------------------------

// Same wrapper for PUT — a body, like POST, but with method overridden.
async function apiPut<T>(path: string, token: string | null, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`API ${path} responded ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// Generate (or reuse cached) AI release notes for a release.
export function generateReleaseNotes(
  token: string | null,
  id: string,
  opts: { force?: boolean } = {},
): Promise<GenerateNotesResponse> {
  return apiPost<GenerateNotesResponse>(`/releases/${id}/release-notes`, token, opts);
}

// Persist a hand-edited Markdown draft.
export function saveReleaseNotes(
  token: string | null,
  id: string,
  markdown: string,
): Promise<Release> {
  return apiPut<Release>(`/releases/${id}/release-notes`, token, { markdown });
}

// --- GitHub repos & branches (for the New Release wizard) --------------------

export type Repo = { fullName: string; defaultBranch: string };

export function fetchRepos(token: string | null): Promise<Repo[]> {
  return apiGet<Repo[]>("/github/repos", token);
}

export function fetchBranches(token: string | null, repo: string): Promise<string[]> {
  return apiGet<string[]>(`/github/branches?repo=${encodeURIComponent(repo)}`, token);
}

// --- Live readiness for a release (real PRs + CI from GitHub) -----------------

export type ReleaseStatusResponse = {
  repo: string;
  branch: string;
  checks: ReleaseCheck[];
  branchTip: BranchTip | null;
};

export function fetchReleaseStatus(
  token: string | null,
  repo: string,
  branch: string,
): Promise<ReleaseStatusResponse> {
  const q = `?repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(branch)}`;
  return apiGet<ReleaseStatusResponse>(`/github/release-status${q}`, token);
}
