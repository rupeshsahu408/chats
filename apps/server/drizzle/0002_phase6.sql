-- Phase 6 additions: blocks, reports, last-seen privacy.

DO $$ BEGIN
  CREATE TYPE "last_seen_privacy" AS ENUM ('everyone','contacts','nobody');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "report_reason" AS ENUM ('spam','harassment','impersonation','illegal','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "last_seen_privacy" "last_seen_privacy" NOT NULL DEFAULT 'contacts';

CREATE TABLE IF NOT EXISTS "blocks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "blocker_user_id" uuid NOT NULL,
  "blocked_user_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocker_fk"
    FOREIGN KEY ("blocker_user_id") REFERENCES "users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_fk"
    FOREIGN KEY ("blocked_user_id") REFERENCES "users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "blocks_pair_idx"
  ON "blocks" ("blocker_user_id","blocked_user_id");
CREATE INDEX IF NOT EXISTS "blocks_blocker_idx" ON "blocks" ("blocker_user_id");
CREATE INDEX IF NOT EXISTS "blocks_blocked_idx" ON "blocks" ("blocked_user_id");

CREATE TABLE IF NOT EXISTS "reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "reporter_user_id" uuid NOT NULL,
  "reported_user_id" uuid NOT NULL,
  "reason" "report_reason" NOT NULL,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_fk"
    FOREIGN KEY ("reporter_user_id") REFERENCES "users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "reports" ADD CONSTRAINT "reports_reported_fk"
    FOREIGN KEY ("reported_user_id") REFERENCES "users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "reports_reporter_idx" ON "reports" ("reporter_user_id","created_at");
CREATE INDEX IF NOT EXISTS "reports_reported_idx" ON "reports" ("reported_user_id");
