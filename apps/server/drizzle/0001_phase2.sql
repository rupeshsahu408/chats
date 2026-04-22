-- Phase 2 additions: TTL + read receipts on messages.
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "read_at" timestamp with time zone;
CREATE INDEX IF NOT EXISTS "messages_expires_idx"
  ON "messages" ("expires_at")
  WHERE "expires_at" IS NOT NULL;
