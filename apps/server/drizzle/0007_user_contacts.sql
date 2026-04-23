CREATE TABLE IF NOT EXISTS "user_contacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "contact_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "custom_name" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_contacts_pair_idx"
  ON "user_contacts" ("owner_user_id", "contact_user_id");

CREATE INDEX IF NOT EXISTS "user_contacts_owner_idx"
  ON "user_contacts" ("owner_user_id");
