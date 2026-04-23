-- Backfill missing profile/username columns that earlier deployments
-- never received. Safe to re-run; everything is IF NOT EXISTS.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "display_name" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_data_url" text;

CREATE UNIQUE INDEX IF NOT EXISTS "users_username_idx"
  ON "users" (lower("username"))
  WHERE "username" IS NOT NULL;
