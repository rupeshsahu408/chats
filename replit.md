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

## Phase 3 — real-time chat (current)

- `messages` table now stores `conversationId` (`min(uid):max(uid)`) and `deliveredAt` so the server keeps history (encrypted) and tracks per-message delivery instead of deleting on fetch.
- Server endpoints: `messages.send` (publishes to WS), `messages.fetchInbox` (undelivered only), `messages.markDelivered`, `messages.fetchHistory` (paginated, both directions). `messages.fetchAndConsume` is kept as a back-compat alias.
- WebSocket relay at `/ws` (`@fastify/websocket`). JWT auth via `?token=…` query string. Server pushes `new_message` and `delivery_receipt`; client sends `ping` and `mark_delivered`.
- Client `lib/wsClient.ts` runs a single tab connection with exponential-backoff reconnect; `lib/SessionSync.tsx` manages WS lifecycle, subscribes to `new_message`, drains the inbox on unlock, and restores per-peer history (5 pages × 100). Polling falls back to a 10s interval whenever the WS is closed.

## Phase 4 — phone signup + contact discovery (current)

- `users.phoneSha` is a pepper-free SHA-256 of `"phone:<+E.164>"` populated at phone signup. The pre-existing `phoneHash` (HMAC w/ pepper) still gates account uniqueness; `phoneSha` is the only thing used for discovery.
- `connections.getDiscoverySalt` rotates a base64 salt every 5 minutes (in-memory).
- `connections.discoverContacts` compares `HMAC(salt, user.phoneSha)` for each phone account against the client-supplied hashes.
- `connections.requestByPeerId` lets a discovered peer be turned into a pending connection request (idempotent).
- Client UI: a "Find" tab on `/connections` accepts a textarea of E.164 numbers, hashes them locally, runs the lookup, and offers a one-tap "Connect" per match.

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
- **`media_blobs` (Phase 5, R2)** — metadata only: owner_user_id, mime, **r2_key** (object key in the R2 bucket), size_bytes, **uploaded** (bool, set true after `finalizeUpload` confirms the PUT), created_at, expires_at. Encrypted bytes live in R2; PG never sees them.
- **`push_subscriptions` (Phase 5)** — Web Push (VAPID) subscriptions: user_id, endpoint (unique), p256dh, auth, user_agent, created_at, last_used_at.

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

### Phase 4.5 (Username + password signup — complete)
- **Schema:** `users` gained `username` (case-insensitive unique partial index), `password_hash` (bcryptjs cost 12), `display_name`, `bio`, `avatar_data_url`. Migration applied via `drizzle-kit push`.
- **Server endpoints:** `auth.checkUsername` (debounced availability + reserved-name list), `auth.issueBotChallenge` / `auth.verifyBotChallenge` (slide-to-verify SVG puzzle, in-memory store at `lib/botChallenge.ts`, single-use HMAC token), `auth.signupRandomV2` (username + password + bot token + identityPublicKey; bcrypt-hashes the password and stores `randomId = "username:<u>"` for legacy chat plumbing), `auth.loginRandomV2` (username + password, constant-time compare, IP + per-user rate limit), `me.updateProfile` (display name / bio / avatar; username NOT editable), `me.lookupByUsername`. `issueSession` + `auth.refresh` now hydrate the new profile fields.
- **PublicUserSchema** extended with `username`, `displayName`, `bio`, `avatarDataUrl` (all nullable for legacy rows).
- **Client signup (`RandomIdSignupPage`):** 7 steps — username (debounced availability) → password + confirm → slide-to-verify puzzle → **Recovery Kit PDF** (visual ProtonMail-style download card; mandatory before proceeding) → optional display name → optional bio → optional avatar (resized client-side to 256×256 JPEG ≤60KB via `lib/avatar.ts`) → welcome popup. Account is created right after the recovery kit is downloaded; profile fields are flushed via `me.updateProfile` after the photo step.
- **Recovery Kit (`lib/recoveryKitPdf.ts` + `components/RecoveryKitDownloadCard.tsx`):** A4 PDF with Veil green header band, "RECOVERY KIT" pill, account/generated meta cards, 4×3 grid of numbered words, scannable QR (errorCorrectionLevel M, links the same 12-word phrase), green-tinted "Treat this like a key" safety panel, footer. Filename `veil-recovery-kit-{username}.pdf`. The download card pre-builds the PDF on mount, shows a mini thumbnail + filename + byte size + circular green button, and turns into a "Saved" pill after the first download. Re-downloadable any time from `Settings → Recovery kit`. `jspdf` + `qrcode` are lazy-imported only when the user actually requests a download.
- **Client login (`RandomLoginPage`):** username + password. If a derived identity already exists in IndexedDB for the returned userId, it skips straight in. Otherwise prompts for the 12-word recovery key to re-derive Ed25519/X25519 on the new device.
- **SlidePuzzle component (`components/SlidePuzzle.tsx`):** pointer-events drag (works on touch + mouse), auto-reissues on failure, surfaces the one-shot bot token to the parent.
- Old `auth.signupRandom` / `auth.loginRandom` / `auth.requestRandomChallenge` endpoints + `SignupRandomInput` / `LoginRandomInput` schemas remain for backward compatibility but are no longer reachable from the UI.
- Email + phone signup/login UI is still hidden behind a "Coming Soon" pill on `WelcomePage`/`LoginPage` (backend untouched).

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

## Phase 5 — Encrypted media via Cloudflare R2 (in progress)

- **Storage moved off Postgres.** `media_blobs` columns are now `mime`, `r2_key`, `size_bytes` (default 0), `uploaded` (default false), plus the timestamps. The encrypted bytes live in R2; the row is just metadata.
- **Server router (`routers/media.ts`):**
  - `media.requestUpload({ mime, sizeBytes })` → inserts an `uploaded=false` row, returns `{ blobId, uploadUrl, uploadContentType, uploadExpiresAt }`. The `uploadUrl` is a 15-minute presigned R2 PUT URL.
  - `media.finalizeUpload({ blobId })` → server `HEAD`s R2 to confirm the object landed, records the real `size_bytes`, flips `uploaded=true`. Oversized objects are deleted from R2 and the row is removed.
  - `media.download({ blobId })` → returns a 5-minute presigned R2 GET URL plus `mime` / `sizeBytes`. Refuses rows where `uploaded=false` or expired.
  - All three return `PRECONDITION_FAILED` listing missing env vars when R2 isn't configured.
- **R2 wrapper (`lib/r2.ts`)** uses `@aws-sdk/client-s3` against `https://<accountId>.r2.cloudflarestorage.com` with `forcePathStyle: true`. Helpers: `presignUpload`, `presignDownload`, `headObject`, `deleteObjects`.
- **Sweeper** now also `DeleteObjects`-batches the corresponding R2 keys whenever it removes expired rows.
- **Body limit** dropped from 12 MB back to 1 MB — the server no longer carries ciphertext.
- **Client (`lib/media.ts`):** `uploadEncryptedMedia` calls `requestUpload` → `fetch(PUT)` directly to R2 with `Content-Type: application/octet-stream` → `finalizeUpload`. `fetchAndDecryptMedia` calls `download` → `fetch(GET)` directly from R2 → AES-GCM decrypt → object URL.
- **New server env vars** (all four required to enable media): `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`. Optional tuning: `MEDIA_MAX_BYTES` (default 16 MB), `MEDIA_TTL_HOURS` (default 24).
- **R2 bucket setup:** the bucket needs a CORS policy allowing `PUT` and `GET` from the client origin(s) with `content-type` in `AllowedHeaders` and `ETag` in `ExposeHeaders`. Example JSON is in `apps/server/.env.example`.

## Contact profile + private contact names (WhatsApp-style)

- **DB:** `user_contacts` (owner_user_id, contact_user_id, custom_name, timestamps; unique on the owner+contact pair). Migration applied via `drizzle-kit push`.
- **Shared:** `Peer` schema gains optional `bio` and `contactName` (the latter is the *requesting* user's private nickname for the peer). `ContactNameSchema`, `SetContactNameInput`, `ContactNameEntrySchema` added.
- **Server:** new `contacts` router (`list`, `set`) — `set` accepts `customName: null` to clear. `connections.list` now LEFT JOINs `user_contacts` and surfaces `contactName` (and `bio`) on each peer in a single query.
- **Client `peerLabel`:** preference order is now `contactName` → `@username` → `displayName` → fingerprint → truncated id, so the chat list, chat header, and any other consumer falls back gracefully.
- **Client `ProfilePage` (`/profile/:peerId`):** WhatsApp-style contact info screen — large avatar, public `@username`, fingerprint, bio, plus a "Saved name (only you can see this)" section with inline add/edit/clear. Rendered as a real route, navigated to from the chat header.
- **Chat header:** the avatar+title block in `ChatThreadPage` is a button that navigates to `/profile/:peerId`. The header now uses `peerLabel(peer)` (contact name → @username → fingerprint) and shows `peerSubLabel` as a small secondary line.

## Phase 6 — Privacy & polish (complete)

- DB: `blocks`, `reports`, plus `last_seen_visibility` enum on `users` (everyone / contacts / nobody).
- Server: `privacy` router (block/unblock/list/report, lastSeenVisibility get/set). Block enforcement in `messages.send` (forbid both directions) and `connections.requestByPeerId` (refuses an inbound request from someone the receiver has blocked). Last-seen filtered by visibility setting.
- Client: ChatThread overflow menu adds Block / Unblock / Report. Settings page adds blocked-contacts list + last-seen radio. `inspect.ts` script trimmed.

## Phase 7 — Group chats (complete, pending e2e verification)

- **Crypto choice:** sender-key scheme equivalent to MLS, mirroring the Phase 3 pragmatic substitute. Each (group, sender, epoch) has a 32-byte chain key. Per send: `msgKey = HMAC(chain, [0x01])`, then `chain ← HMAC(chain, [0x02])`. Out-of-order tolerated via a 64-key skipped-key cache. AES-GCM with the JSON header + 4-byte counter as AD. Implemented in `apps/client/src/lib/signal/group.ts`.
- **Key distribution:** Sender Key Distribution Messages (SKDMs) ride the existing 1:1 Double Ratchet to every other member. New `ChatEnvelope` variant `{ t: "skdm", gid, ep, ck }`; `messageSync.ts` routes inbound SKDMs to `groupSync.handleIncomingSenderKey` and never persists them as chat rows.
- **Membership/epoch:** every membership change bumps `groups.epoch` server-side and broadcasts a `group_changed` WS event. `SessionSync` listens and calls `rotateMySenderKeyIfNeeded`, which lazily generates+distributes a fresh chain key under the new epoch.
- **DB (Neon):** migration `0003_phase7.sql` — `groups`, `group_members`, plus `messages.group_id` with a partial index. Applied.
- **Server routers:** `routers/groups.ts` (create/list/get/addMembers/removeMember/leave/updateMeta/setRole, admin enforcement, WS fan-out via `notifyMembers`) and `routers/messages.ts` extended with `sendGroup` (per-recipient ciphertext fan-out + push fan-out + block check) and `fetchGroupHistory` (deduped by `(sender, createdAt)`).
- **Client storage:** Dexie v7 — `groupSenderKeys` (composite `[groupId+senderUserId+epoch]` index) + `groupMessages` (with `dedupKey = sender:epoch:counter`).
- **Client orchestrator:** `lib/groupSync.ts` — `ensureMySenderKey`, `rotateMySenderKeyIfNeeded`, `sendGroupChat`/`sendGroupText`, `ingestGroupInboxMessage`, `handleIncomingSenderKey`, `resetLocalGroup`, `reapExpiredGroupMessages`.
- **UI:** `/groups` (list + create-group dialog from connections), `/groups/:groupId` (chat with sender labels + auto-scroll + history restore), `/groups/:groupId/settings` (members list, add/remove, promote/demote, edit name/desc, leave). Tab toggle on `/chats` ↔ `/groups`.

## PWA install prompts (cross-phase polish)

- `components/InstallPrompt.tsx` is mounted globally in `App.tsx`.
- **Android / desktop Chrome:** captures `beforeinstallprompt`, suppresses the default mini-bar, and renders an in-app banner with "Install" → calls `prompt()`.
- **iOS Safari:** detects iOS + Safari (excluding in-app browsers like Instagram/FB/Line/Chrome-iOS) and renders a banner whose "Show me how" opens a 3-step "Add to Home Screen" instruction sheet (Share icon → Add to Home Screen → Add).
- Hidden when already in standalone mode (`display-mode: standalone` or `navigator.standalone`).
- Dismissals persist for 7 days in `localStorage` (`veil:install-prompt:dismissed-at`) to avoid nagging.
- Listens for `appinstalled` to clear the banner immediately on install.

## Push permission prompt (post-install)

- `components/PushPermissionPrompt.tsx` is mounted globally in `App.tsx` next to `InstallPrompt`.
- Renders an in-app "Get notified of new messages" banner **only when all of these are true**:
  1. App is running standalone (`display-mode: standalone` or `navigator.standalone`) — covers Android-installed PWA *and* iOS Add-to-Home-Screen.
  2. User is signed in (`useAuthStore.accessToken` present).
  3. Push is supported (`serviceWorker` + `PushManager` + `Notification`).
  4. `Notification.permission === "default"` (never prompts after grant/deny).
  5. Not dismissed within the last 7 days (`veil:push-prompt:dismissed-at`).
- Tap **Enable** → calls `ensurePushSubscription({ requestPermission: true })`. Tap **Not now** or X → 7-day cooldown.
- Effect: iOS Safari users in a normal browser tab never see the prompt (push doesn't work there pre-iOS 16.4 in-browser anyway). They get prompted only after they Add-to-Home-Screen and re-open Veil.
- Settings → Notifications still works as the manual fallback for users who previously dismissed.

## Receive-path resilience (v2)

Production messaging on Vercel ↔ Render exposed a "zombie WebSocket" failure mode where `readyState === OPEN` but the server had already dropped the socket — every `new_message` event was lost and the original polling fallback (which only ran when `!wsClient.isOpen()`) skipped it.

Fixes in `lib/SessionSync.tsx` + `lib/wsClient.ts`:
- **Always poll**, even when the WS looks healthy (`20s` cadence when open, `8s` when closed). Guarantees worst-case message latency of 20s on any reachability problem.
- **Drain on `visibilitychange` (visible), `focus`, and `online`** events — instant catch-up the moment a user returns to a backgrounded tab or the network reconnects.
- **WS watchdog**: tracks `lastIncomingAt` (any message, including pongs); if 70s elapse with no traffic, force-close the socket so reconnect logic kicks in immediately instead of trusting a dead `readyState`.

Diagnosed via direct prod-DB inspection: messages were being inserted but `delivered_at` was NULL for every recent row, proving the write path worked and the read path was the failure point.

### Duplicate-message follow-up

The always-on poll exposed a pre-existing race: the WS push and a poll drain (or two poll drains from focus + visibility + interval firing back-to-back) both ran `hasChatMessageWithServerId` → `appendChatMessage` non-atomically, so two or more passed the check and each inserted their own copy (3–4 duplicates were common). Fixed in two layers:

1. **`lib/messageSync.ts`**: in-memory `inFlightIngest` map keyed by `m.id` — concurrent calls share the same Promise, so only the first one does the work.
2. **`lib/db.ts` `appendChatMessage`**: when `serverId` is present, the existence-check + insert run inside a single `db.transaction("rw", db.chatMessages, …)` so concurrent transactions can't both insert.

## Public landing page

`pages/LandingPage.tsx` is the new public entry at `/`. The previous signup-options screen moved to `/welcome`. Self-contained marketing page (no auth, no tRPC, no app shell):

- Sticky transparent → blurred nav with mobile drawer.
- Hero with gradient headline, dual CTAs ("Get started" → `/welcome`, "See how it works" → `#how`), and an animated phone mockup.
- Trust bar with 4 stat tiles.
- 9-card feature grid (encryption, no phone needed, disappearing messages, group chats, voice/media, push, stealth mode, multi-device PWA, open source).
- "How it works" three-step explainer.
- Security section with X3DH / Double Ratchet / zero-knowledge / open-source breakdown plus a faux code panel.
- Veil-vs-typical-messenger comparison table.
- Accordion FAQ (6 questions, first one open by default).
- Final gradient CTA card and a 5-column footer with social links.

`SessionBootstrap` was updated so a signed-in user landing on `/` or `/welcome` is still bounced to `/chats`.

## Phase 7.5 — Power features (implemented)

### Message Scheduling (1:1 chats)
- New `ScheduledMessageRecord` interface + `scheduledMessages` Dexie table (v9, index on `peerId, scheduledFor, sent`).
- `onScheduleMessage(text, scheduledFor)` saves a record to IndexedDB; helper functions: `saveScheduledMessage`, `getAllPendingScheduledMessages`, `markScheduledMessageSent`, `deleteScheduledMessage`.
- A `useEffect` in `ChatThreadInner` polls every 60 s, finds due messages for the current peer, calls `sendChatMessage`, and marks them sent.
- UI: a 🕐 clock button appears in the composer when text is present; tapping opens `SchedulePickerSheet` (native `datetime-local` input). A "Scheduled messages" item in the 3-dot menu opens `ScheduledMessagesSheet` (live Dexie query, Cancel per row).

### @Mentions in Group Chats
- Mention tokens: `@<8-hex-fingerprint>` embedded in plaintext.
- Ingest: `groupSync.ts` `ingestGroupInboxMessage` now extracts mention tokens and stores them in `GroupMessageRecord.mentions[]`.
- Autocomplete: typing `@` in the group composer triggers a live-filtered dropdown of member fingerprints; selecting one inserts `@<fingerprint> ` at the cursor.
- Rendering: `renderMentionText` splits message text on `@<fp>` tokens and wraps each in a highlighted `<span>` (green for own mention, white/10 for others).

### Group Polls
- New envelope types `PollEnvelope` (`t: "poll"`) and `PollVoteEnvelope` (`t: "poll_vote"`) in `messageEnvelope.ts`; both added to `ChatEnvelope` union.
- `GroupMessageRecord` gains optional `pollData` (`{pollId, question, choices}`) and `pollVoteData` (`{pollId, choiceIdx}`) fields (no Dexie index change needed — v9).
- Send helpers: `sendGroupPoll` and `sendGroupPollVote` in `groupSync.ts`.
- UI: 📊 poll button in the group composer opens `PollComposer` modal (question + up to 8 options). Received polls render as `PollBubble` with live vote aggregation, progress bars, and tap-to-vote/retract (choiceIdx -1 retracts).
- Poll-vote messages are invisible in the message list — they update `PollBubble` state only.

### Chat list / 1-on-1 chat polish (Apr 2026)
- **Live typing indicator on chat list rows.** New `apps/client/src/lib/typingStore.ts` (zustand) holds per-peer `{kind, expiresAt}` with a 6s safety TTL and a 1.5s prune interval. `SessionSync` now subscribes to WS `typing` events and writes into this store; `ChatsPage` row subtitles override the last-message preview with `typingLabel(kind)` ("typing…", "🎤 recording…", "📷 sharing a photo…") in accent color when active.
- **Swipe-to-reply in 1-on-1 chats.** `MessageRowSlot` in `ChatThreadPage` now owns three gestures (tap / long-press / horizontal swipe) with shared touch refs. Horizontal moves >8px engage swipe (mine swipe left, peer swipes right), cancel the long-press timer, and translate the row up to ±90px. Releasing past 50px fires `onQuickReply`. A faded `↩` icon appears on the appropriate side mid-swipe.
- **Per-contact snooze sheet.** New `SnoozeSheet` component (next to `TTLPicker`) offers 1 hour / 8 hours / Until tomorrow (8 AM, locale-formatted) / 1 week / Always (year 9999 ISO). `menuOpen` union extended with `"snooze"`; ChatMenu's mute item now opens the sheet on first tap and unmutes in one tap when already muted, replacing the old hard-coded 8h toggle.
- **Mark as unread (long-press inbox row).** New `markedUnread?: boolean` field on `ChatPrefRecord` (no schema migration needed — Dexie object stores accept new fields freely). `ChatsPage` adds a 450ms long-press / right-click handler per row that opens a `ChatRowActionSheet` with toggles for Mark unread / Pin / Mute (8h). Marked-unread chats render a small green dot badge in place of the empty `UnreadBadge` and float above their tier-mates in the sort. `ChatThreadInner` clears the flag in a guarded `useEffect` whenever it sees `chatPref.markedUnread === true`, so opening the chat is the canonical "I've now read this" gesture and we don't churn `updatedAt` on every open.
- **Per-contact theme + sound ("Customize chat").** Two new optional fields on `ChatPrefRecord`: `chatAccent?` (palette key) and `notificationSound?` (sound pack key). New `lib/chatPersonality.ts` defines 8 accent swatches (`ACCENT_SWATCHES`) and 6 sound packs (`SOUND_PACKS`) — each pack is a `{notes, oscillator, duration, gain}` shape that `playReceiveTone(packKey)` in `lib/sound.ts` synthesizes via Web Audio (still no asset files). `feedback.receive(packKey)` accepts the pack and `messageSync` looks up the sender's `chatPref.notificationSound` before firing it, so each peer has their own arrival cue. `ChatPersonalitySheet` opens from the Chat menu's "Customize chat" entry; it previews accent on a sample bubble and plays the chosen pack on tap. Accent is applied via a scoped `<style>` block keyed off a `data-veil-accent` attribute on the chat root + `data-veil-send-btn` on the send button — no Tailwind rebuild, no global CSS edits, override is purely per-thread.
- **Vault PIN fallback (Apr 2026).** Two new optional fields on `UserPrefRecord` — `vaultPinHash?` and `vaultPinSalt?` (Dexie v13 no-op bump for documentation; new optional fields don't need an index change). New `lib/vaultPin.ts` wraps `argon2id` from `hash-wasm` with the same KDF profile as identity encryption (3 iter / 64 MB / 32-byte output); `hashVaultPin(pin)` → `{hash, salt}`, `verifyVaultPin(pin, hash, salt)` does a constant-time byte compare. `VaultPage` enrollment now offers two paths: device biometrics (WebAuthn, when supported) or a 4–8 digit PIN — the picker auto-defaults to the PIN form on devices without WebAuthn so Linux desktops and older browsers can still enroll. Lock screen shows whichever method is enrolled (biometrics with auto-prompt; "Use PIN instead" link when both are set). `PinSetupForm` and `PinEntryForm` are inline components inside `VaultPage.tsx`; PIN never leaves the device. Subtitle on each vaulted chat row now reads "Hidden · biometric-locked" or "Hidden · PIN-locked" depending on enrollment.

- **"Moments that convert" onboarding pass (Apr 2026).** Four entry-point surfaces redesigned end-to-end so first impressions feel deliberate instead of utilitarian:
  - **Identity ceremony.** New `KeyCeremony` step inserted between the slide-puzzle and the recovery-key reveal in `RandomIdSignupPage` (signup is now 9 steps, not 8). A pulsing concentric-rings emblem with sequential checklist reveals — "Generating identity key → Forging recovery phrase → Sealing prekey bundle → Identity ready" — runs over ~3 s, then the recovery phrase is generated lazily inside the ceremony's `onReady` callback so the user sees the keys "appear" instead of being pre-filled. The final welcome screen is now a `WelcomeCeremony` with paced fade-in phases and a soft glow under the logo.
  - **Safety number as art.** New `lib/safetyArt.tsx` derives an 8×8 horizontally-mirrored Identicon-style SVG from the 60-digit safety number using FNV-1a as the seed, with two HSL accent hues chosen from the first/last digit groups. `formatSafetyRows` chunks the digits into 4 rows of 3 groups for legibility. `SafetyNumberDialog` in `ChatThreadPage` now renders the art piece (208 px) above the digit rows, with Copy + "Mark as verified" actions; verification adds a green ring + checkmark badge (purely local, never uploaded).
  - **Invite cards as a pass.** `InviteCreatedCard` in `InvitePage` rebuilt as a passport-style ticket: green-tinted header band, inviter avatar/displayName/handle, key fingerprint (loaded from local identity via `publicKeyFingerprint`), centered QR, and a 3-line "trust handshake" bullet list. A new Share action uses `navigator.share` when available (mobile system share sheet) and falls back to Copy. The empty "no invites" state now uses the new tour-tip layout to explain what an invite actually does.
  - **Empty states as guides.** `EmptyState` (in `Layout.tsx`) gained two optional props: `tipsTitle?: string` and `tips?: { icon?, title, body }[]`. When tips are provided, they render below the action as a vertical stack of small staggered fade-in cards with accented icon tiles. Used in `ChatsPage`, `ConnectionsPage` (people tab), `GroupsPage`, and `InvitePage` to teach users what they can do here ("Invite someone", "Long-press a chat", "Verify the safety number", "Up to 256 members", etc.) instead of leaving the screen blank.
- **Mood / status broadcast ("What's up?").** New `myMood?` field on `UserPrefRecord` and `peerMood?` on `ChatPrefRecord`, each `{emoji, text, expiresAt}`. New `MoodEnvelope` (`t: "mood"`) added to the `ChatEnvelope` union with matching `decodeEnvelope` validation; the side-effect handler in `messageSync.ts` mirrors the envelope onto `chatPrefs.peerMood` (empty payload = clear). New `lib/moodSync.ts` exposes `broadcastMood(identity, payload)` which persists locally then encrypts the envelope to every entry in `connections.list` (best-effort, swallowed per-peer errors), `clearMood`, `getActiveMyMood` (auto-filters expired), `MOOD_PRESETS` (8 Hinglish-friendly picks like "📚 padh raha hoon", "🚗 driving — text only"), and `moodCountdownLabel`. `MoodSheet` is the picker — emoji+text inputs, preset grid, TTL chips (1h/2h/4h/8h/1d), live "active mood" banner with one-tap Clear. Wired into `ChatsPage` header (smiley chip showing your current emoji+text) and `ChatThreadPage` header subtitle (peer's mood replaces "online/last seen" when active). All moods are E2EE — server only sees ciphertext, expiry is purely client-side via `Date.now() > expiresAt`.

## Design philosophy pages (Apr 2026)

A 10-point design philosophy is being built into Veil page-by-page. Each principle gets a dedicated surface so the values are visible and verifiable, not just claimed:

- **Principle #1 — Welcome rewrite.** `WelcomePage.tsx` rewritten as a single hero with "Random ID" as the recommended path, two "coming soon" cards for phone/email, an end-to-end-encrypted micro-badge, a 3-cell trust strip ("No ads, ever / Zero tracking / Lives on your device"), and a discreet link to the Promises page.
- **Principle #2 — Sound as identity, not alarm.** `SoundPage.tsx` (`/sound`). Master sound + haptics toggles, a volume slider that writes through to the live sound bus, and per-motif "Play" buttons that demo Tap, Send, Receive, Success, Error in isolation. Persisted via new `soundVolume?` field on `UserPrefRecord`; `stealthPrefs.syncFeedbackModules` mirrors the volume into `lib/sound.setSoundVolume()` on hydrate.
- **Principle #3 + #6 — Show the wires.** `UnderTheHoodPage.tsx` (live cipher suite, identity keys, prekey count, session state) and `WhatWeStorePage.tsx` (field-by-field DB transparency) plus a Settings "Transparency" section that surfaces both.
- **Principle #4 — Calm by default (Focus Mode).** `FocusModePage.tsx` (`/focus-mode`) with three independent levers — manual snooze (30 min / 1 h / 4 h / Until morning), master Focus toggle, and a daily quiet-hours window with overnight-wrap awareness. New optional fields on `UserPrefRecord`: `focusModeEnabled`, `quietHoursEnabled`, `quietHoursStart`, `quietHoursEnd`, `snoozeUntil`. Single source of truth in `lib/focusMode.ts`: `deriveFocusState(prefs)` returns `{active, reason, endsAt}`; `isFocusActiveNow()` is a synchronous read off the cached prefs that `feedback.receive()` calls to silence the in-app sound + haptic without breaking message arrival. `useFocusState()` ticks once a minute so the inbox AppBar's `FocusChip` and the Settings `FocusModeStatusRow` both stay accurate as quiet hours end or snoozes elapse.
- **Principle #7 + #8 — Promises (the manifesto).** `PromisesPage.tsx` (`/promises`). Four numbered cards — "No ads. Ever.", "We don't sell or share your data.", "Your messages live on your device.", "The code is open." — each with a one-line rule and a one-line "how we keep it" proof. Linked from the Welcome trust strip and the Settings Transparency section.
- **Principle #9 + #10 — Recovery as a moment.** `RandomIdSignupPage.tsx` includes a `RecoveryReveal` step that frames the recovery phrase as a ceremony rather than a chore.

Remaining: **Principle #5 — group chat simplicity** (a focused pass on `GroupSettingsPage` + `GroupChatPage` to reduce visual complexity).

## Next phase

**Native iOS (Phase 8) and Android Play Store (Phase 9) are deferred.** The product launches as an installable PWA: Android users install via Chrome's prompt, iOS users use Add-to-Home-Screen (web push works on iOS 16.4+ once installed). Phase 7 wrap-up — manual e2e group test (3 accounts) + push verification — remains the only outstanding item before launch readiness.

## User preferences

- User manages their own database (Neon) and all third-party API keys; will store them in `.env` files. Do not provision external services for them or use platform-managed keys.
- Build phase-by-phase per the plan in `attached_assets/Pasted-Veil-Complete-Finalized-Plan-Summary-...txt`.
