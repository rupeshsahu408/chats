-- Daily verification password (random-ID accounts).
-- Stored as a bcrypt hash; user must re-enter it every 24 hours
-- before being allowed back into the main app.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "verification_password_hash" text;
