-- Server-side scheduled messages queue (E2EE preserved: payload is the
-- already-encrypted header + ciphertext, just like a normal message).

DO $$ BEGIN
  CREATE TYPE "scheduled_status" AS ENUM ('pending','delivered','cancelled','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "scheduled_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sender_user_id" uuid NOT NULL,
  "recipient_user_id" uuid NOT NULL,
  "conversation_id" text NOT NULL,
  "header" bytea NOT NULL,
  "ciphertext" bytea NOT NULL,
  "expires_in_seconds" integer,
  "scheduled_for" timestamp with time zone NOT NULL,
  "status" "scheduled_status" NOT NULL DEFAULT 'pending',
  "delivered_message_id" uuid,
  "delivered_at" timestamp with time zone,
  "failed_at" timestamp with time zone,
  "fail_reason" text,
  "attempts" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_sender_fk"
    FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_recipient_fk"
    FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "sched_sender_idx"
  ON "scheduled_messages" ("sender_user_id", "status");

CREATE INDEX IF NOT EXISTS "sched_due_idx"
  ON "scheduled_messages" ("scheduled_for")
  WHERE "status" = 'pending';
