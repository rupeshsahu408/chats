-- Phase 7 additions: groups, group_members, messages.group_id.

DO $$ BEGIN
  CREATE TYPE "group_role" AS ENUM ('admin','member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "groups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "epoch" integer NOT NULL DEFAULT 0,
  "created_by_user_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "groups" ADD CONSTRAINT "groups_creator_fk"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "groups_creator_idx" ON "groups" ("created_by_user_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "group_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "group_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "role" "group_role" NOT NULL DEFAULT 'member',
  "joined_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_fk"
    FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "group_members_pair_idx"
  ON "group_members" ("group_id","user_id");
CREATE INDEX IF NOT EXISTS "group_members_group_idx" ON "group_members" ("group_id");
CREATE INDEX IF NOT EXISTS "group_members_user_idx" ON "group_members" ("user_id");
--> statement-breakpoint

ALTER TABLE "messages"
  ADD COLUMN IF NOT EXISTS "group_id" uuid;

CREATE INDEX IF NOT EXISTS "messages_group_idx"
  ON "messages" ("group_id","created_at")
  WHERE "group_id" IS NOT NULL;
