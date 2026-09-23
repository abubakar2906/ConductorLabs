-- Track when a push last landed on the branch a release was cut from.
-- Consumed by POST /webhooks/github (GitHub push events).
-- Safe to re-run: ADD COLUMN IF NOT EXISTS.
ALTER TABLE releases
  ADD COLUMN IF NOT EXISTS last_push_at timestamptz;