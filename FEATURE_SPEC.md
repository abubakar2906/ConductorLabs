# Feature Spec: `POST /webhooks/github`

## Problem

Conductor knows which repos and branches users are tracking, but nothing in
the server listens for GitHub activity. The readiness engine answers
`GET /github/release-status` on demand by polling GitHub per request; there is
no record of when a tracked branch last received a push. The PRD lists
`POST /api/webhooks/github` as part of the minimum API surface, and CLAUDE.md
tracks it as an open item.

## Goal

Give the server a webhook receiver for GitHub events so that push activity on
tracked branches is recorded the moment it happens, instead of only being
discoverable when someone opens the release detail page.

## Non-goals

- No readiness re-computation or caching. Readiness stays **derived, never
  stored** (PRD invariant) — the client keeps computing it live from
  `GET /github/release-status`.
- No new tables. One nullable column on the existing `releases` table.
- No client UI in this pass. The stored timestamp is the data; a
  "Last push: 3h ago" line on the release pages is a follow-up.
- No `pull_request` / `check_run` / `workflow_run` handling beyond
  acknowledgment. Push is the signal this feature records.

## API

`POST /webhooks/github` — public route, **no ClerkGuard** (GitHub cannot send
a Clerk JWT). Auth is the HMAC signature, not a user session.

| Step | Condition | Response |
|------|-----------|----------|
| 1 | `GITHUB_WEBHOOK_SECRET` env var missing/empty | `503 { "error": "Webhook secret not configured" }` |
| 2 | `X-Hub-Signature-256` header missing or HMAC-SHA256 of raw body doesn't match | `401 { "error": "Invalid signature" }` |
| 3 | `X-GitHub-Event: ping` | `200 { "received": true, "event": "ping" }` |
| 4 | `X-GitHub-Event: push` | match, record, `200 { "received": true, "event": "push", "matchedReleases": n }` |
| 5 | any other event | `200 { "received": true, "event": "<name>" }` |

Step 4 detail:

- Branch = `payload.ref` with the `refs/heads/` prefix stripped. Non-branch
  refs (tags, PR refs) match nothing — that is fine, they just count as zero.
- Match = `releases` rows where `repo_full_name = payload.repository.full_name`
  AND `target_branch = <branch>`. All matches are updated; one push touching
  two of a user's releases updates both.
- Effect = set `last_push_at = now()` on every matched row.
- If no releases match, return `200` with `matchedReleases: 0` (still
  2xx — the event was received and valid, we just have nothing to record).

### Why 503 for a missing secret

503 means "this server is not configured to serve webhooks" — our fault, not
the caller's. 401 is reserved for callers that presented a bad credential.
Failing closed (503) also means a mis-deployed server never pretends to accept
signed traffic it can't verify.

## Schema

One additive, nullable column on `releases` (shipped as
`supabase/migrations/0001_add_release_last_push_at.sql`):

```sql
ALTER TABLE releases
  ADD COLUMN IF NOT EXISTS last_push_at timestamptz;
```

The migration is idempotent. The user applies it once in the Supabase
dashboard SQL editor (the repo has no migration runner; see "Deployment").

### Graceful degradation when the column is missing

The feature can deploy before the SQL is applied. If the update hits
`42703` (column does not exist), the receiver logs a warning and still
returns 200. Reason: GitHub retries failed deliveries with backoff; a 5xx
would turn a one-time missing column into a retry storm and log spam. The
data is simply not recorded until the migration is applied.

## Implementation plan (server only)

New `server/src/webhooks/` module:

- `webhooks.controller.ts` — `@Controller('webhooks')`, `@Post('github')`.
  No guard. Reads `req.body`, the `x-hub-signature-256` and `x-github-event`
  headers, delegates to the service.
- `webhooks.service.ts`
  - `verifySignature(rawBody: string, signature: string): boolean` —
    HMAC-SHA256 with `GITHUB_WEBHOOK_SECRET`, compared with
    `crypto.timingSafeEqual` (length-guarded, constant-time).
  - `handleEvent(event: string, payload: unknown)` — routes the events in the
    table above; for `push`, upserts `last_push_at` on matching rows via the
    existing `supabase()` helper, swallows the 42703 case per the degradation
    rule, and returns the match count.
  - `secretConfigured(): boolean` — lets the controller answer 503 without the
    service leaking the secret.
- `webhooks.module.ts` — wires controller + service.
- `app.module.ts` — import `WebhooksModule`.
- `server/.env.example` — document `GITHUB_WEBHOOK_SECRET`.

The `Release` row shape already flows through `select('*')`, so the new
column needs no service or client changes to round-trip.

## Testing

`server/src/webhooks/webhooks.controller.spec.ts` using `@nestjs/testing`
(`Test.createTestingModule` with a stubbed `WebhooksService` — standard NestJS
controller test, only the DI boundary is stubbed):

- no `GITHUB_WEBHOOK_SECRET` → 503
- missing signature header → 401
- bad signature (service says verify failed) → 401
- `ping` → 200, `event: 'ping'`
- `push` with matches → 200, `event: 'push'`, `matchedReleases` passthrough
- unrecognized event → 200, event echoed

`webhooks.service.spec.ts` for the crypto core, against a fixed secret (no
module mocking — real `crypto`):

- `verifySignature` true for a correctly computed HMAC
- `verifySignature` false for a wrong signature and for a mismatched length
- `extractBranch` strips `refs/heads/` and passes through non-branch refs

## Deployment

1. Merge.
2. In the Supabase SQL editor: run
   `supabase/migrations/0001_add_release_last_push_at.sql`.
3. In the server's environment: set `GITHUB_WEBHOOK_SECRET` to a long random
   string.
4. In each tracked repo's GitHub settings: add a webhook pointing at
   `https://<server-host>/webhooks/github`, content type `application/json`,
   secret = the same value, events = at least "Pushes". GitHub sends a
   `ping` on save — that is the smoke test (expect 200).

## Out of scope / follow-ups

- `pull_request` / `check_run` / `workflow_run` side effects.
- An activity feed UI fed by this data (PRD marks it post-MVP, display-only).
- Showing `last_push_at` on the release list/detail pages.