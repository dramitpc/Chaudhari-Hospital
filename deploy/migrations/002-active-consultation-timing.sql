-- Additive and repeatable. Existing timing records remain elapsed-only.
ALTER TYPE queue_status ADD VALUE IF NOT EXISTS 'paused';
ALTER TYPE queue_status ADD VALUE IF NOT EXISTS 'awaiting_investigations';
ALTER TYPE queue_status ADD VALUE IF NOT EXISTS 'ready_for_review';
ALTER TABLE queue_tokens ADD COLUMN IF NOT EXISTS active_started_at timestamptz;
ALTER TABLE queue_tokens ADD COLUMN IF NOT EXISTS active_seconds integer;
ALTER TABLE queue_tokens ADD COLUMN IF NOT EXISTS initial_seconds integer;
ALTER TABLE queue_tokens ADD COLUMN IF NOT EXISTS review_seconds integer NOT NULL DEFAULT 0;
ALTER TABLE queue_tokens ADD COLUMN IF NOT EXISTS session_count integer NOT NULL DEFAULT 0;