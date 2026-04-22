CREATE TYPE "public"."account_type" AS ENUM('email', 'phone', 'random');--> statement-breakpoint
CREATE TYPE "public"."connection_request_status" AS ENUM('pending', 'accepted', 'rejected', 'canceled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."otp_purpose" AS ENUM('signup', 'login');--> statement-breakpoint
CREATE TABLE "connection_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_user_id" uuid NOT NULL,
	"to_user_id" uuid NOT NULL,
	"invite_id" uuid,
	"status" "connection_request_status" DEFAULT 'pending' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_a_id" uuid NOT NULL,
	"user_b_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inviter_user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"label" text,
	"max_uses" integer DEFAULT 1 NOT NULL,
	"used_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invites_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "media_blobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"mime" text NOT NULL,
	"ciphertext" "bytea" NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_user_id" uuid NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"conversation_id" text NOT NULL,
	"header" "bytea" NOT NULL,
	"ciphertext" "bytea" NOT NULL,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "one_time_prekeys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"key_id" integer NOT NULL,
	"public_key" "bytea" NOT NULL,
	"claimed_at" timestamp with time zone,
	"claimed_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier_hash" text NOT NULL,
	"code_hash" text NOT NULL,
	"purpose" "otp_purpose" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed" boolean DEFAULT false NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"device_label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "sessions_refresh_token_hash_unique" UNIQUE("refresh_token_hash")
);
--> statement-breakpoint
CREATE TABLE "signed_prekeys" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"key_id" integer NOT NULL,
	"public_key" "bytea" NOT NULL,
	"signature" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_type" "account_type" NOT NULL,
	"email_hash" text,
	"phone_hash" text,
	"phone_sha" text,
	"random_id" text,
	"identity_pubkey" "bytea" NOT NULL,
	"identity_x25519_pubkey" "bytea",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "connection_requests" ADD CONSTRAINT "connection_requests_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connection_requests" ADD CONSTRAINT "connection_requests_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connection_requests" ADD CONSTRAINT "connection_requests_invite_id_invites_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."invites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_user_a_id_users_id_fk" FOREIGN KEY ("user_a_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_user_b_id_users_id_fk" FOREIGN KEY ("user_b_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_inviter_user_id_users_id_fk" FOREIGN KEY ("inviter_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_blobs" ADD CONSTRAINT "media_blobs_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "one_time_prekeys" ADD CONSTRAINT "one_time_prekeys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "one_time_prekeys" ADD CONSTRAINT "one_time_prekeys_claimed_by_user_id_users_id_fk" FOREIGN KEY ("claimed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signed_prekeys" ADD CONSTRAINT "signed_prekeys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "connreq_to_idx" ON "connection_requests" USING btree ("to_user_id","status");--> statement-breakpoint
CREATE INDEX "connreq_from_idx" ON "connection_requests" USING btree ("from_user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "connreq_pending_pair_idx" ON "connection_requests" USING btree ("from_user_id","to_user_id") WHERE "connection_requests"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "connections_pair_idx" ON "connections" USING btree ("user_a_id","user_b_id");--> statement-breakpoint
CREATE INDEX "connections_a_idx" ON "connections" USING btree ("user_a_id");--> statement-breakpoint
CREATE INDEX "connections_b_idx" ON "connections" USING btree ("user_b_id");--> statement-breakpoint
CREATE INDEX "invites_inviter_idx" ON "invites" USING btree ("inviter_user_id");--> statement-breakpoint
CREATE INDEX "media_owner_idx" ON "media_blobs" USING btree ("owner_user_id","created_at");--> statement-breakpoint
CREATE INDEX "media_expiry_idx" ON "media_blobs" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "messages_recipient_idx" ON "messages" USING btree ("recipient_user_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_inbox_idx" ON "messages" USING btree ("recipient_user_id","created_at") WHERE "messages"."delivered_at" IS NULL;--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "otpk_user_idx" ON "one_time_prekeys" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "otpk_user_key_idx" ON "one_time_prekeys" USING btree ("user_id","key_id");--> statement-breakpoint
CREATE INDEX "otpk_unclaimed_idx" ON "one_time_prekeys" USING btree ("user_id") WHERE "one_time_prekeys"."claimed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "otp_identifier_idx" ON "otp_codes" USING btree ("identifier_hash");--> statement-breakpoint
CREATE INDEX "push_user_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "push_endpoint_idx" ON "push_subscriptions" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_hash_idx" ON "users" USING btree ("email_hash") WHERE "users"."email_hash" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_hash_idx" ON "users" USING btree ("phone_hash") WHERE "users"."phone_hash" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_random_id_idx" ON "users" USING btree ("random_id") WHERE "users"."random_id" IS NOT NULL;