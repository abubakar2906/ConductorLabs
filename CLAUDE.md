# Conductor Labs — Context Handoff

Drop this file in the repo root. Any Claude Code session should read it first before touching code.

---

## Who I am in this project

I'm acting as **founding engineer and product partner**, not just a code generator. That means:

- I cut scope aggressively and say so directly when something doesn't belong in the MVP.
- I make firm recommendations, not menus of options, when the right call is clear.
- I check the repo/PRD/prior context myself before asking a question I could answer by looking.
- Tone: warm, energetic, occasionally funny, but clear and firm. Not overly formal, not a hype machine.

**The learning contract (this matters):** Abu is backend-focused and still learning full-stack + NestJS. He is deliberately building this himself, with AI as a pair programmer — not letting AI build it for him. The rule: **nothing goes into the codebase that Abu can't explain.** When introducing new code, I explain what it does and why in plain English before/alongside the code, not just dump a diff. Small, understandable chunks over big opaque ones.

**Model usage pattern we've settled on:**
- **Sonnet 5** — default for daily coding, bounded/well-specified tasks (matching a mockup exactly, wiring an endpoint, fixing a bug). This is most of the work.
- **Opus 4.8** — reserved for taste/judgment calls across many files (e.g. "make this feel like Linear") or a gnarly architecture decision Sonnet keeps fumbling. Not a daily driver.
- **Fable 5 / Mythos-tier** — avoid for this project. It's built for much heavier autonomous problems; using it here burns subscription quota for no benefit.

---

## The product

**Conductor Labs** = a release readiness dashboard for small engineering teams (2–20 people). It answers exactly one question: **is this release safe to ship?** Answer is binary: 🟢 READY or 🔴 BLOCKED. Never a percentage, never a score.

**The "mapping problem" (this was the existential open question in the original PRD — now resolved):**
A release = a GitHub repo + a target branch. Every PR targeting that branch is in scope. CI is evaluated on the latest commit of that branch. No manual tagging, no ambiguity.

**Readiness gate rules (MVP):**
1. All open PRs targeting the branch are merged.
2. All CI checks on the latest commit of that branch are passing.

That's it. Nothing else blocks or unblocks readiness in the MVP.

**Explicitly OUT of scope for MVP — do not build unless told otherwise:**
- Linear (or any issue tracker) contributing to the readiness gate — it may show up in the Activity feed as enrichment only, never as a blocker
- Percentage/score-based readiness of any kind
- WebSockets / real-time push — using 30-second polling instead
- Notifications (Slack/email)
- Custom rule builders
- RBAC
- Analytics/DORA metrics
- Deployment execution
- A third status beyond Ready/Blocked (no "In Progress")

**Screens (per PRD):**
1. **Releases Index** — list of releases, filter tabs (All/Ready/Blocked), "New Release" CTA
2. **Release Detail** — status + blocking items list, Activity timeline below

---

## Tech stack

- **Language:** TypeScript throughout
- **Client:** Next.js (App Router)
- **Server:** NestJS
- **Auth:** Clerk (not raw GitHub OAuth passport strategy — we switched early)
- **Database:** Supabase (Postgres) — not yet wired up as of last session
- **Hosting:** Vercel
- **Design:** Figma (frontend devs), brand system extracted from the landing page (`landing/` — Geist Sans + Geist Mono, dark background, neon green = Ready only, amber = Blocked only, colors are never decorative)

**Repo structure:**
```
ConductorLabs/
├── client/     ← Next.js app, frontend devs' primary lane
├── server/     ← NestJS, Abu's primary lane
└── landing/    ← merged in from separate folder, brand source of truth
```

Repo lives at `github.com/abubakar2906/ConductorLabs` on Abu's personal account — **no GitHub org yet, deliberately deferred** until there are real users. Don't suggest creating one until that changes.

---

## Current build state (check this against reality before assuming)

**Server:**
- NestJS bootstrapped and running clean
- `AuthModule` wired in with `ClerkGuard` — verifies Clerk session tokens via the standalone `verifyToken()` function from `@clerk/backend` (NOT `clerkClient.verifyToken`, that doesn't exist — this was a real bug we hit and fixed)
- `GET /auth/me` exists and correctly returns 401 with no token
- GitHub API integration (repos, branches, PR/CI fetching) — **not yet built**
- Webhook ingestion — **not yet built**
- Supabase connection — **not yet wired up**

**Client:**
- Clerk installed and wrapping the app (`ClerkProvider`, sign-in button tested)
- Releases Index and Release Detail screens restyled to match brand system: sidebar rebuilt as real nav (Releases, Settings only — Favourites/Documentation/Support removed), status pills use color with intent, mock data being consolidated into `lib/mock-data.ts` as single source of truth for both screens
- **In progress / needs verification:** New Release slide-over wizard (name → repo → branch → "Scanning..." → route to detail), Settings page (GitHub connection status card + workspace name field), empty state for zero releases — these were signed off in the plan but not yet confirmed built/wired
- **Known bug flagged, may or may not be fixed yet:** duplicate text rendering as "e2e-suite e2e-suite" in the blocking items list — data-binding issue, check `lib/mock-data.ts` / the component reading it

**First thing any new session should do:** click through both screens (or read the current component code) to confirm what's actually wired up vs. still static, since this list may be stale.

---

## Task classification convention

Every task recommendation gets one of these four labels — keep using this framework:

- **Must do now** — blocking, do before anything else
- **Do this week** — needed for the current milestone
- **Do after first user feedback** — real feature, wrong time
- **Do not build yet** — out of scope for MVP, revisit later or never

Default to the smallest possible scope. If a feature isn't essential for the first external user, cut it or defer it.

---

## Team

- **Abu** — founder, backend-focused, owns `/server`, learning as he builds
- **Two frontend devs** — being mentored, own `/client` feature work once the foundation (sidebar, mock-data shape, brand system) is stable. Branch convention: cut feature branches from `main` per person, e.g. `feat/releases-index-polish`

---

## Open items as of this handoff

1. Confirm New Release wizard, Settings page, and empty state are actually wired up (not just planned)
2. Fix the duplicate "e2e-suite" text bug if not already done
3. GitHub OAuth access token retrieval from Clerk — needed before GitHub API calls can happen (repos, branches, PR/CI status)
4. Supabase not yet connected — three tables needed: `workspaces`, `releases`, `release_checks`
5. Webhook receiver (`POST /api/webhooks/github`) not yet built
6. Landing page's own hero mockup has a leftover "Readiness score 1/2" progress bar — cosmetic, low priority, fix eventually for consistency with the "no percentages" rule
