# Feature Spec — Delete a Release

**Branch:** `feat/delete-release`
**Owner:** Helix (for Abu's review)
**Date:** 2026-09-22

## Why this feature

The release CRUD is incomplete: the user can create, list, and open a release,
but can never remove one. A stray or mistyped release row sticks around forever,
and there is no way to clean it up. Deleting is the last piece of the basic
CRUD loop and it is the smallest feature that completes the story.

This is deliberately NOT the webhook receiver or 30-second polling: those need
Supabase/webhook plumbing that isn't wired up yet, and this change works on the
existing pieces (Supabase `releases` table + detail page).

## Expected behavior

### Server — `DELETE /releases/:id`

- Requires auth (ClerkGuard, same as every other `/releases` route).
- Deletes the release row **only if it belongs to the requesting user**.
  Ownership is enforced in the query itself (`.eq('user_id', userId)`), so a
  user can never delete someone else's release.
- Returns the deleted release row with status **200**.
- Returns **404** if the release doesn't exist or belongs to a different user
  (we don't leak which is which — same answer for both).

### Client — Delete button on the release detail page

- A "Delete release" action sits at the bottom of the detail card, visually
  separated from the status content (muted, destructive-styled button).
- Two-step confirm, no browser `confirm()` dialog:
  1. First click arms it: the button changes to "Confirm delete".
  2. A second click sends `DELETE /releases/:id`; while the request is in
     flight the button shows a spinner and is disabled.
  3. On success the page navigates to `/releases` (the list no longer shows it).
  4. On failure an inline error line appears under the button and the button
     stays armed so the user can retry.

## Files touched

| File | Change |
| --- | --- |
| `server/src/releases/releases.service.ts` | New `deleteByIdForUser(userId, id)` — Supabase `.delete()` scoped to the user, returns the deleted row or `null` |
| `server/src/releases/releases.controller.ts` | New `@Delete(':id')` route → 200 with the deleted row, or 404 |
| `client/lib/api.ts` | New `apiDelete` helper + `deleteRelease(token, id)` |
| `client/app/releases/[id]/page.tsx` | "Delete release" two-step confirm in the detail card + `useRouter` for the redirect |
| `server/src/releases/releases.controller.spec.ts` | New Jest spec covering the route (happy path + 404) |

## Acceptance criteria

1. `DELETE /releases/:id` with a valid token and an existing, owned release
   → 200, response body is the deleted release row.
2. `DELETE /releases/:id` for a non-existent id (or another user's release)
   → 404.
3. Unauthenticated requests are rejected (401) — inherited from the existing
   ClerkGuard on the controller.
4. The detail page shows "Delete release"; first click → "Confirm delete";
   second click → spinner while deleting; success → lands on `/releases`;
   failure → inline error, no navigation.
5. `npm run build` exits 0 in `server/` and `client/`.
6. `npm test` in `server/` exits 0, including the new spec.

## Notes for Abu (plain English)

- **Why the query scoping matters:** Postgres has no concept of "this user's
  row" — if we deleted by id alone, anyone with a valid login could delete
  anyone else's release by guessing the id. Adding `.eq('user_id', userId)`
  means the row is only found (and deleted) if it's actually yours.
- **Why `.select().maybeSingle()` after `.delete()`:** PostgREST supports
  returning the deleted row (SQL `RETURNING`). `maybeSingle()` means
  "zero or one row" — so a missing id gives us `data: null` instead of an
  error, which is exactly the 404 signal the controller needs.
- **Test boundary:** the spec tests the controller with the service swapped
  for a test double (the standard NestJS controller-test pattern — the guard
  and the HTTP layer are real, only the Supabase call is stubbed). The
  service itself can't be unit-tested without a live Supabase database;
  that will get covered once the e2e suite has a test DB.
