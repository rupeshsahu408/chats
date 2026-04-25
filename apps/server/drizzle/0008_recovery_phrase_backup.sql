-- Encrypted backup of the BIP-39 recovery phrase, used to let users
-- recover their ORIGINAL identity on a new device using only their
-- daily verification password (no rotation, chat history preserved).
--
-- All three columns are base64-encoded strings. The server cannot
-- decrypt — the key is derived client-side from the daily password.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "encrypted_recovery_phrase" text,
  ADD COLUMN IF NOT EXISTS "recovery_phrase_iv" text,
  ADD COLUMN IF NOT EXISTS "recovery_phrase_salt" text;
