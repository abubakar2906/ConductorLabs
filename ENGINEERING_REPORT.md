# Conductor Labs — Engineering Report

_A build-log and architecture reference for the session that took the app from mock UI to a real, data-driven product. Written so you can own the system: what was built, how it works, why it was built this way, and the traps we hit along the way._

---

## 1. What the product is

Conductor Labs answers one question: **is this release safe to ship?** A release = a GitHub repo + a target branch. The answer is binary — **🟢 Ready** or **🔴 Blocked** — decided by two rules:

1. No open PRs targeting the branch.
2. All CI checks passing on the branch's latest commit.

Nothing else gates readiness. No scores, no percentages.

---

## 2. The system at a glance

There are **two separate programs** running, plus **three external services**.

```
┌─────────────────┐        ┌──────────────────┐
│  Next.js client │        │  NestJS server   │
│  "front desk"   │──────▶ │  "back office"   │
│  localhost:3000 │  token │  localhost:3001  │
└─────────────────┘        └──────────────────┘
        │                     │        │        │
        │ (Clerk JS)          │        │        │
        ▼                     ▼        ▼        ▼
     ┌──────┐            ┌──────┐  ┌──────┐  ┌────────┐
     │Clerk │            │Clerk │  │GitHub│  │Supabase│
     │(FAPI)│            │(API) │  │ API  │  │(Postgres)
     └──────┘            └──────┘  └──────┘  └────────┘
```

- **Next.js client** (`/client`) — the browser UI. Talks to Clerk directly for login, and to our own server for everything else.
- **NestJS server** (`/server`) — the only program that holds secret keys and is allowed to call GitHub, Clerk's backend API, and the database.
- **Clerk** — authentication. Two faces: the **FAPI** (`*.clerk.accounts.dev`, browser-facing) and the **Backend API** (`api.clerk.com`, server-facing).
- **GitHub REST API** — source of truth for PRs and CI.
- **Supabase (Postgres)** — stores the releases a user is tracking.

**Golden rule of the architecture:** secrets and third-party calls live on the server. The browser never sees the Clerk secret key, the Supabase service-role key, or the user's GitHub token. It only ever holds a short-lived Clerk session token, which it uses to prove who it is to our server.

---

## 3. The request bridge (client ↔ server)

Everything real flows through one pattern: the client attaches the user's Clerk session token to each request; the server verifies it. This is the single most reused piece of the system.

**Client side** — `client/lib/api.ts`:

```ts
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function apiGet<T>(path: string, token: string | null): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`API ${path} responded ${res.status}`);
  return res.json() as Promise<T>;
}
```

The token is fetched in components with Clerk's `useAuth().getToken()` and passed in. Every feature (GitHub status, releases, repos) is a one-line wrapper over `apiGet` / `apiPost`.

**Server side** — the guard that checks the token, `server/src/auth/clerk.guard.ts`:

```ts
@Injectable()
export class ClerkGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.split(' ')[1];
    if (!token) throw new UnauthorizedException();
    try {
      const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
      request.auth = payload;          // req.auth.sub = the Clerk user id
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
```

Note `verifyToken` is the **standalone function** from `@clerk/backend` — not `clerkClient.verifyToken` (that doesn't exist; it was an early bug). Any controller can now read `req.auth.sub` to know who's calling.

**CORS** had to be opened so the browser (port 3000) is allowed to call the server (port 3001) — `server/src/main.ts`:

```ts
app.enableCors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  credentials: true,
});
```

---

## 4. Authentication & identity

- **Login** is Clerk with GitHub OAuth. The recommendation was to make GitHub the *only* sign-in method so every logged-in user necessarily has a GitHub token available — this removes an entire "connect GitHub" flow we'd otherwise have to build.
- **The route gate** lives in `client/middleware.ts`. It protects every page except sign-in/sign-up:

```ts
const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);
export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) await auth.protect();
});
```

- **Identity in the UI** — the Settings card and sidebar show the real user. The sidebar reads `useUser()` and prefers the GitHub handle, falling back to email:

```ts
const githubAccount = user?.externalAccounts?.find((a) => a.provider === "github");
const handle = githubAccount?.username ?? user?.username ?? email ?? "Account";
```

  (On the **client**, Clerk names the provider `"github"`; on the **server** it's `"oauth_github"`. That mismatch is real and bit us in a type error.)

- **The GitHub token** is pulled server-side and never exposed to the browser — `server/src/auth/github-token.service.ts`:

```ts
async getAccessToken(userId: string): Promise<string | null> {
  const { data } = await clerkClient().users.getUserOauthAccessToken(userId, 'github');
  return data[0]?.token ?? null;
}
```

---

## 5. The GitHub data engine

This is the heart of the product — `server/src/github/github.service.ts`. It answers the two readiness questions from live GitHub data and returns them in a shape the readiness engine already understands.

```ts
async getReleaseChecks(token, repoFullName, branch): Promise<ReleaseCheck[]> {
  const [owner, repo] = repoFullName.split('/');
  const [prs, ci] = await Promise.all([
    this.getOpenPullRequests(token, owner, repo, branch),  // Rule 1
    this.getCiChecks(token, owner, repo, branch),          // Rule 2
  ]);
  return [...prs, ...ci];
}
```

- **Rule 1 — open PRs:** `GET /repos/{owner}/{repo}/pulls?state=open&base={branch}`. Any result blocks the release.
- **Rule 2 — CI:** `GET /repos/{owner}/{repo}/commits/{branch}/check-runs`, mapped to passing/failing/pending:

```ts
private ciStatus(run): 'passing' | 'failing' | 'pending' {
  if (run.status !== 'completed') return 'pending';               // queued / running
  const nonBlocking = ['success', 'neutral', 'skipped'];
  return nonBlocking.includes(run.conclusion) ? 'passing' : 'failing';
}
```

Every GitHub call goes through one authenticated helper (Bearer token + required `User-Agent` header). The same service also lists the user's repos (`GET /user/repos`) and a repo's branches (`GET /repos/.../branches`) to feed the New Release wizard.

**Endpoints** (`github.controller.ts`, all behind `ClerkGuard`):
- `GET /github/repos` — the user's repos
- `GET /github/branches?repo=` — a repo's branches
- `GET /github/release-status?repo=&branch=` — the live checks

---

## 6. The readiness engine

Pure logic, no I/O — `client/lib/readiness.ts`. It takes a flat list of checks and returns a status + the list of what's blocking. Because it operates on plain data, it runs identically on mock data or live GitHub data.

```ts
export function computeReadiness(checks: ReleaseCheck[]): Readiness {
  const blockingItems: BlockingItem[] = [];
  for (const check of checks) {
    if (check.type === "PR" && check.status === "open")
      blockingItems.push({ /* ...PR is open... */ reason: "Open" });
    if (check.type === "CI" && check.status !== "passing")
      blockingItems.push({ /* ...CI ... */ reason: check.status === "failing" ? "Failing" : "Pending" });
  }
  return { status: blockingItems.length === 0 ? "ready" : "blocked", blockingItems };
}
```

The `ReleaseCheck` shape here is deliberately identical to what the server returns and what the old `mock-data.ts` used — that's what made swapping mock → real a near drop-in.

---

## 7. Persistence (Supabase)

A single table holds the releases a user tracks. Readiness is **never stored** — it's always computed live — so there's no status column.

```sql
create table releases (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,          -- the Clerk user id (req.auth.sub)
  name text not null,
  repo_full_name text not null,
  target_branch text not null,
  created_at timestamptz not null default now()
);
```

The server accesses it with the **service-role key** (server-only, bypasses row-level security; we enforce ownership ourselves by filtering on `user_id`). Endpoints (`releases.controller.ts`, behind `ClerkGuard`): `GET /releases`, `GET /releases/:id`, `POST /releases`.

---

## 8. End-to-end data flow

**Creating a release:**
1. Wizard fetches real repos (`/github/repos`) → user picks one → fetches its branches (`/github/branches`) → user picks one.
2. `POST /releases` saves the row, scoped to `req.auth.sub`.
3. Client routes to `/releases/{new id}`.

**Viewing readiness:**
1. Board calls `GET /releases` → your rows.
2. For each row, `GET /github/release-status?repo=&branch=` → live checks → `computeReadiness()` → the pill.
3. Detail page does the same for one release and lists the blocking items.

No mock data remains in this path.

---

## 9. Key architectural decisions

| Decision | Why |
|---|---|
| **Two processes (Next + Nest), not one** | Keeps secrets and third-party calls off the browser. The browser only ever holds a short-lived session token. |
| **Store the readiness *shape* once, share it** | `ReleaseCheck` / `computeReadiness` are identical across mock and real, so going live was a swap, not a rewrite. |
| **Readiness is computed, never stored** | Status can go stale the instant a PR opens. Computing live from GitHub is always correct; the DB only stores *what to track*. |
| **GitHub-only login** | Eliminates the "not connected to GitHub" edge case and a whole connect-flow. Everyone in has a token. |
| **Do Supabase before wiring the wizard** | The database is the spine — build it first so "create" has somewhere to save, instead of shipping a picker that saves nowhere. |
| **Lazy singletons for external clients** | See §10 — reading env vars at import time is too early. Build the client on first use. |

---

## 10. Pitfalls & lessons (the expensive ones)

### 10.1 DNS blocking `api.clerk.com` — the big one
**Symptom:** after signing in, an endless `/sign-in ⇄ /releases` redirect loop. The browser thought it was logged in; the server thought it wasn't.

**Root cause:** the machine's DNS could resolve Clerk's browser API (`*.clerk.accounts.dev`) but **not** `api.clerk.com`, which the *server* needs to verify sessions. So the client said "signed in" and the server said "signed out," forever.

**Why it was so hard:** it survived every cookie/cache/history clear because it was a *network* problem, not a state problem. We chased several wrong theories first (see below).

**Diagnosis (one command):**
```bash
node -e "require('dns').lookup('api.clerk.com',(e,a)=>console.log(e?e.message:a))"
# EAI_AGAIN = broken; an IP = fine
```
**Fix:** point the machine's DNS at `1.1.1.1` / `8.8.8.8`, flush DNS. This is local-dev-only — a deployed server reaches Clerk normally, so it won't affect users.

**Lesson:** when client and server disagree about auth state and clearing cookies doesn't help, suspect the *server's* ability to reach the auth provider. Check DNS before touching code.

### 10.2 The env-timing bug → lazy clients
**Symptom:** `Missing Clerk Secret Key`, even though the key was in `.env`.

**Root cause:** the Clerk client was built at **import time** (top of the file), which runs *before* Nest loads `.env`. So it captured an undefined key. The `ClerkGuard` worked fine because it reads the key **per request** (after `.env` is loaded).

**Fix — build on first use, not on import:**
```ts
let client: ReturnType<typeof createClerkClient> | null = null;
export function clerkClient() {
  if (!client) client = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  return client;
}
```
We applied the same pattern to the Supabase client. **Lesson:** read configuration when you *use* it, not when the module loads.

### 10.3 `middleware.ts` vs `proxy.ts` (Next 16)
Next 16 deprecates `middleware.ts` in favor of `proxy.ts`. We migrated — and auth broke. The two run on **different runtimes** (middleware = Edge, proxy = Node), and Clerk's session handshake behaved differently. **We reverted to `middleware.ts` and stay there.** The deprecation warning is harmless. _(This turned out not to be the loop's real cause — DNS was — but the runtime difference is real and worth knowing.)_

### 10.4 Port 3000 collision
The NestJS server defaulted to port 3000 — the same as Next.js — so starting both crashed one with `EADDRINUSE`. Fixed by setting `PORT=3001` in `server/.env`.

### 10.5 Red herrings we chased (and why they were wrong)
- **"Stale handshake URL in browser history"** — plausible (the token was byte-identical across restarts), but clean URLs still looped. Not it.
- **"Third-party cookies / clear site data"** — clearing only made a *worse* half-signed-in state (client session alive on `accounts.dev`, gone on `localhost`). Not the root cause.
- **Lesson:** an identical token across restarts *and* a client/server split both pointed at "the server can't verify" — which is DNS. We'd have saved time checking `dns.lookup` first.

---

## 11. Security notes

- `server/.env` and `client/.env.local` are **gitignored and untracked** (verified). Secrets never hit git.
- The **Clerk secret key** and **Supabase service-role key** live only on the server. The service-role key bypasses row-level security, so ownership is enforced in code (`.eq('user_id', req.auth.sub)`).
- The browser only ever holds a **short-lived Clerk session token**. It never sees the GitHub token, which is fetched server-side per request.
- `NEXT_PUBLIC_*` vars are visible to the browser by design — only non-secret values (publishable key, API URL) use that prefix.

---

## 12. File map

**Server (`/server/src`)**
- `main.ts` — bootstrap + CORS + `PORT`
- `auth/clerk.guard.ts` — verifies the session token
- `auth/clerk-client.ts` — lazy Clerk backend client
- `auth/github-token.service.ts` — pulls the user's GitHub token
- `auth/auth.controller.ts` — `GET /auth/me`, `GET /auth/github/status`
- `github/github.service.ts` — all GitHub REST calls + check mapping
- `github/github.controller.ts` — `/github/repos`, `/github/branches`, `/github/release-status`
- `releases/releases.service.ts` — Supabase reads/writes
- `releases/releases.controller.ts` — `/releases` CRUD (list/get/create)
- `supabase/supabase.client.ts` — lazy Supabase client

**Client (`/client`)**
- `middleware.ts` — the auth gate
- `lib/api.ts` — the request bridge (all server calls)
- `lib/readiness.ts` — the Ready/Blocked engine
- `components/releases-view.tsx` — the board (real releases + live status)
- `components/new-release-slideover.tsx` — the create wizard (real repos/branches)
- `components/sidebar.tsx` / `settings-view.tsx` — real identity
- `app/releases/[id]/page.tsx` — detail page (live readiness)

---

## 13. What's left for beta

The app is functionally complete on `localhost`. The remaining step is **deployment** so testers use a link:
- **Client** → Vercel.
- **Server** → a Node host (Railway / Render / Fly).
- Set the production env vars (Clerk, Supabase, `FRONTEND_URL`, and the client's `NEXT_PUBLIC_API_URL` → the deployed server).
- Bonus: deploying permanently ends the local DNS issue, since the host resolves `api.clerk.com` normally.

Nice-to-haves after first feedback: delete-a-release, the Activity timeline (post-MVP), and turning off email login in Clerk to lock in GitHub-only.

---

_End of report._
