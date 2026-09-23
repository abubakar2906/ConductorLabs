-- AI release notes: the generated Markdown plus the metadata that lets the
-- server cache it against the branch tip it was written from.
-- Safe to re-run: ADD COLUMN IF NOT EXISTS.
ALTER TABLE releases
  ADD COLUMN IF NOT EXISTS release_notes text,
  ADD COLUMN IF NOT EXISTS notes_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS notes_edited boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes_tip_sha text;
