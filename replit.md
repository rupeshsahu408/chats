# Veil

> Private by design. Visible to no one but you.

A Progressive Web App messenger — end-to-end encrypted, open-source, no ads, no tracking.

## Repo layout (pnpm monorepo)

```
veil/
├── apps/
│   ├── client/        React 18 + Vite + TS + Tailwind PWA (port 5000)
│   └── server/        Fastify + tRPC + Drizzle backend (port 3001)
├── packages/
│   └── shared/        Shared TS types & zod schemas
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

## Local dev

- `pnpm dev` — runs client + server concurrently via `concurrently`.
- Client: http://localhost:5000.
- Server: http://localhost:3001 (`/health` is public; `/trpc/*` for the API).
- Vite dev proxy: `/api/*` → `http://127.0.0.1:3001/*` (rewrites away the `/api` prefix).
- `pnpm typecheck` and `pnpm build` are green.
- DB: `pnpm --filter @veil/server db:push` to sync schema to Neon.
  Optional: `db:generate` to write SQL migration files; `db:studio` for the Drizzle Studio UI.

## Workflow

A single Replit workflow named **`Start application`** runs `pnpm dev` and waits on port 5000 (webview).

## Environment / secrets

The user manages **all** secrets themselves and stores them in `.env` files — never in code, never via platform-managed keys. Examples committed: `apps/client/.env.example`, `apps/server/.env.example`. Real `.env` files are git-ignored.

### Server (`apps/server/.env`) — required for Phase 1

| Var                       | Required for                  | How to get / generate |
|---------------------------|-------------------------------|-----------------------|
| `DATABASE_URL`            | All auth                      | Neon connection string (postgres://… ?sslmode=require) |
| `JWT_SECRET`              | All auth                      | `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `REFRESH_TOKEN_SECRET`    | (reserved; not used yet)      | Same generator |
| `IDENTIFIER_HMAC_PEPPER`  | Hashing email/phone           | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `RESEND_API_KEY`          | Sending OTP emails            | resend.com (free 3,000/mo). **Optional in dev** — when missing, OTPs are logged to the server console instead of emailed. |
| `RESEND_FROM`             | Sender address                | Defaults to `Veil <onboarding@resend.dev>` for testing |

When required vars are missing, the server still starts and `/health` works, but every auth tRPC procedure returns `PRECONDITION_FAILED` with a clear message listing the missing vars. After editing `.env`, restart the workflow.

After setting `DATABASE_URL`, run **`pnpm --filter @veil/server db:push`** once to create the tables.

### Client (`apps/client/.env`)

Only `VITE_API_BASE_URL` if you ever need to point the client at a non-default API base (defaults to `/api`, which the Vite proxy forwards to the server).

## Stack (full plan, by phase)

- **Frontend:** React 18 + Vite + TS + Tailwind + Zustand + Dexie + react-router-dom + react-hook-form + @noble/curves + hash-wasm + @trpc/react-query + @tanstack/react-query + framer-motion + vite-plugin-pwa.
- **Backend:** Node + Fastify + tRPC + Drizzle ORM + postgres-js + jose (JWT) + bcryptjs + Resend + @fastify/cookie + @fastify/cors.
- **Crypto (device-side):** @noble/curves Ed25519 (Phase 1 identity) → swap to Signal Protocol in Phase 3 + MLS in Phase 7.
- **Data:** Neon Postgres, Upstash Redis (Phase 5+), Cloudflare R2 (Phase 5).
- **Auth/notifications:** Resend (email OTP), Firebase (SMS OTP, Phase 4), Web Push / FCM / APNs (Phase 5).

## Database schema (Phases 1–3)

- `users` — id, account_type, email_hash (HMAC), phone_hash, random_id, identity_pubkey (bytea, Ed25519), **identity_x25519_pubkey (bytea, nullable, Phase 3)**, timestamps. Partial unique indexes on each identifier column.
- `otp_codes` — bcrypt-hashed code, identifier_hash, purpose enum, expires_at, attempts, consumed.
- `sessions` — sha256(refresh_token), user_id, device_label (UA), expires_at.
- `signed_prekeys` — one per user (replaceable): keyId, public key (32 B X25519 in Phase 3), Ed25519 signature (64 B).
- `one_time_prekeys` — many per user, capped at 100 unclaimed: keyId (unique per user), public key (32 B X25519 in Phase 3), claimed_at, claimed_by_user_id. Partial index on `claimed_at IS NULL` for fast unclaimed lookups.
- `invites` — inviter_user_id, sha256(token) only, label, max_uses, used_count, expires_at, revoked_at. Raw token never stored.
- `connection_requests` — from_user_id → to_user_id, status (pending/accepted/rejected/canceled/expired), optional ≤140-char note, invite_id (nullable), decided_at. Partial unique index ensures only one pending request per (from, to) pair.
- `connections` — canonical (user_a_id < user_b_id) so a single row represents the bidirectional link. Unique on (user_a, user_b).
- **`messages` (Phase 3)** — opaque encrypted mailbox: sender_user_id, recipient_user_id, header (bytea, plaintext JSON header), ciphertext (bytea, AES-GCM), created_at. Index on (recipient, created_at). Rows are deleted by `messages.fetchAndConsume` so the server doesn't retain ciphertext long-term.

## Auth flow (Phase 1)

1. **Signup:**
   - Client → `auth.requestEmailOtp({ email, purpose: "signup" })`
   - Server: rate-limit per-email (3/hr) + per-IP (10/10min). Generate 6-digit OTP, bcrypt-hash, store with 5-min TTL. Send via Resend (or log in dev). Always returns generic "delivered" to prevent enumeration.
   - Client generates Ed25519 identity keypair locally.
   - Client → `auth.verifyEmailOtp({ email, code, purpose: "signup", identityPublicKey })`
   - Server: verify code (max 5 attempts), insert user with email_hash + identity_pubkey, issue JWT (15-min) + opaque refresh token (30-day, sha256-stored, set as httpOnly `veil_refresh` cookie).
   - Client prompts for Backup PIN, derives AES key via Argon2id (64 MB / 3 iter), AES-GCM-encrypts the private key, stores in IndexedDB via Dexie. Private key never leaves the device.

2. **Login:** same OTP flow with `purpose: "login"`. No identity key needed (already on device or restored later from history backup in Phase 3).

3. **Session bootstrap:** on app load, the client silently calls `auth.refresh` using the cookie. If valid, it gets a fresh access token and skips re-auth.

4. **Logout:** invalidates the session row + clears the cookie. Local identity is **not** wiped (WhatsApp model — encrypted history & device key stay).

### Privacy properties

- Email never stored in plaintext — only HMAC-SHA256(email, server pepper).
- Login/signup responses don't reveal whether an account exists for the email.
- Identity private key is generated, encrypted, and stored entirely on-device.
- Server logs redact `Authorization` and `Cookie` headers.

## Connection flow (Phase 2)

1. **Alice** opens `/invite`, picks max-uses (1/5/10) and expiry (1h–30d), and clicks Create. Server returns the raw token **once**; Alice copies the link or screenshots the QR. Server only ever stores `sha256(token)`.
2. **Bob** opens the link `/i/:token` (signed in or not). The public **preview** shows Alice's account type, the short identity-key fingerprint (`xxxx-xxxx`), her join date, and her user ID — **never email or phone**.
3. If Bob isn't signed in, the token is stashed in `sessionStorage`; signup/login redirects him back to the redeem page automatically.
4. Bob taps **Send connection request** with an optional ≤140-char note. Server creates a `connection_requests` row, increments `used_count`, refuses self-redeem and duplicate pending requests.
5. **Alice** sees the request in `Connections → Pending`, with Bob's fingerprint + note, and Accepts or Rejects. Accepting inserts a canonical `connections` row in a transaction with the request status update.
6. Either side can later **Disconnect** from `Connections → People`, which deletes the connection row.
7. Pending outgoing requests are visible in `Connections → Sent`, where the requester can Cancel.

### Prekey bootstrap

After PIN setup at signup, the client generates 1 signed prekey + 20 one-time prekeys (Ed25519 placeholders — Phase 3 swaps to X25519 for X3DH; the wire shape stays). The signed prekey is signed by the identity key. Public halves are uploaded; private halves stay in IndexedDB. The Chats hub shows current prekey status. `prekeys.claimBundleFor` is wired and gated to connected peers; Phase 3 will exercise it.

## Chat flow (Phase 3)

1. **Identity setup.** Each account has two long-term keypairs:
   - **Ed25519** — used for signatures (signed-prekey signature) and the displayed fingerprint.
   - **X25519** — used for X3DH ECDH. Public key uploaded via `me.setX25519Identity`, private key encrypted on-device with the same Backup PIN.
   New signups generate both up-front. Existing Phase 1/2 accounts auto-migrate the first time they unlock chats: a fresh X25519 identity is generated, encrypted with the PIN, persisted, and uploaded; prekeys are re-uploaded as X25519 with `replaceOneTime: true`.

2. **Unlock.** Chat features are gated behind a PIN-entry `UnlockGate`. Decrypted private keys live only in a non-persisted Zustand store (`useUnlockStore`); refresh = re-locked.

3. **X3DH (initiator).** First outbound message in a session calls `prekeys.claimBundleFor` (now a mutation since it consumes a one-time prekey). Client verifies the signed-prekey signature against the peer's Ed25519 identity, runs four DHs (`IK_A·SPK_B`, `EK_A·IK_B`, `EK_A·SPK_B`, `EK_A·OPK_B`), then HKDFs a 32-byte shared secret with a `0xFF*32` prefix.

4. **Double Ratchet.** Alice initialises with the shared secret + Bob's signed-prekey pub as `DHr`. Bob initialises lazily on first inbound message using his own SPK as `DHs`. Each direction switch performs a DH ratchet step; chain keys advance per-message via HMAC. Skipped-message keys are cached per-DH-pub up to 100 entries to tolerate out-of-order delivery.

5. **Wire format.** Header is a small JSON blob (UTF-8 → base64): `{ v, init?, dh, n, pn }`. The optional `init` block (`ek`, `ikX`, `spkId`, `opkId`) is present only on the first message of a session and triggers the responder X3DH on receive. AEAD is AES-GCM-256 with `AD = our_IK_X || peer_IK_X || header_bytes`.

6. **Transport.** `messages.send` writes the opaque ciphertext + header for the recipient (gated to connected peers). `messages.fetchAndConsume` (atomic SELECT + DELETE) is polled every 3–5 s while unlocked; decrypted plaintexts are appended to a Dexie `chat_messages` log on this device only.

7. **Forward secrecy.** Server stores ciphertext just long enough for the recipient to fetch it. One-time prekey privates are deleted from local storage immediately after the X3DH responder consumes them. Lost session state cannot be recovered from the server.

## Current phase

**Phase 4 — Phone (SMS OTP via Firebase) + Random-ID account types (complete).**

### Phase 3 (1:1 Signal Protocol chat — complete)
- Server: `users.identity_x25519_pubkey` column added; new `messages` table; routers `me.setX25519Identity` (idempotent), `messages.{send,fetchAndConsume}` (connection-gated, delete-on-fetch), `prekeys.upload` extended with `replaceOneTime`, `prekeys.claimBundleFor` is now a mutation returning `identityX25519PublicKey`.
- Shared: `SetX25519IdentityInput`, `SendMessageInput`, `InboxMessageSchema`, `UploadPrekeysInputV2`, `PrekeyBundleSchemaV2`.
- Client crypto: `lib/signal/{x25519,kdf,aead,x3dh,ratchet,session}.ts` — full X3DH + Double Ratchet implementation built on `@noble/curves` + WebCrypto.
- Client storage: Dexie v3 adds `chat_sessions` (per-peer serialized ratchet state) + `chat_messages` (per-peer plaintext log). `IdentityRecord` gains `encX25519PrivateKey`/`iv2`/`salt2`/`x25519PublicKey`.
- Client unlock: `lib/unlock.ts` decrypts both privates and runs the X25519 migration when needed; `useUnlockStore` keeps them in memory only.
- Client UI: `UnlockGate`, `ChatThreadPage` at `/chats/:peerId` with composer + 3-second poll, `ChatsPage` hub now lists conversations (per-peer last-message preview) + unlock pill.

### Phase 4 (Phone + Random ID auth — complete)
- **Phone auth (Firebase SMS):** server `auth.verifyFirebasePhone` verifies Firebase ID tokens using `firebase-admin` (conditionally initialised from `FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY`). Client `PhoneSignupPage` and `PhoneLoginPage` use Firebase JS SDK reCAPTCHA verifier + `signInWithPhoneNumber`. Both show a clear "Firebase not configured" fallback when env vars are absent.
- **Random ID auth:** `auth.signupRandom` registers a `veil_xxxxxxxx` ID + Ed25519 public key. Challenge-response login: `auth.requestRandomChallenge` issues a short-lived JWT; `auth.loginRandom` verifies the client's Ed25519 signature against the stored public key. Server uses `@noble/curves/ed25519.js`.
- **BIP-39 recovery phrase:** `@scure/bip39` (browser-native ESM) generates 12-word mnemonics. `crypto.ts` derives Ed25519 (bytes 0-31) + X25519 (bytes 32-63) keypairs deterministically from seed via `mnemonicToSeedSync`. Phrase-derived accounts skip PIN entry; `iv: "phrase-derived"` marker in `IdentityRecord` distinguishes them.
- **UnlockGate** detects account type and shows either PIN input or 12-word recovery phrase textarea.
- **Contact discovery:** `connections.getDiscoverySalt` + `connections.discoverContacts` implement double-HMAC scheme with 5-minute rotating in-memory salts.
- **New routes:** `/signup/phone`, `/signup/random`, `/login/phone`, `/login/random`. Welcome + Login pages show all three options (Phone option shows "setup needed" badge when Firebase vars are absent).
- **Packages added:** `firebase` (client), `firebase-admin` (server), `@scure/bip39` (client; replaced CJS `bip39`).
- Typecheck (`pnpm -r typecheck`): green across `shared`, `server`, `client`.

> **Server env vars added in Phase 4:** `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (all optional — omitting disables phone auth with clear errors). Client: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`.

## Next phase

**Phase 5 — WebSocket transport + push notifications + media attachments.**

## User preferences

- User manages their own database (Neon) and all third-party API keys; will store them in `.env` files. Do not provision external services for them or use platform-managed keys.
- Build phase-by-phase per the plan in `attached_assets/Pasted-Veil-Complete-Finalized-Plan-Summary-...txt`.
