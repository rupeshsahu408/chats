-- Opt-in flag for the public "Discover people" directory.
-- Defaults to false so existing accounts stay unlisted until the user
-- explicitly turns it on from Settings.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "is_discoverable" boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "users_discoverable_idx"
  ON "users" ("is_discoverable")
  WHERE "is_discoverable" = true;
