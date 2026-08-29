// The phone line to the NestJS "back office".
//
// Every real request to our server has to prove who's asking, so each call
// attaches the current user's Clerk token in the `Authorization` header —
// exactly what the server's ClerkGuard checks. The token is fetched on the
// client via Clerk's `getToken()` and passed into these helpers.

import type { ReleaseCheck } from "@/lib/readiness";

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
};

export function fetchReleaseStatus(
  token: string | null,
  repo: string,
  branch: string,
): Promise<ReleaseStatusResponse> {
  const q = `?repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(branch)}`;
  return apiGet<ReleaseStatusResponse>(`/github/release-status${q}`, token);
}
