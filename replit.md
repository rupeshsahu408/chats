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

## Database schema (Phase 1)

- `users` — id, account_type, email_hash (HMAC), phone_hash, random_id, identity_pubkey (bytea), timestamps. Partial unique indexes on each identifier column.
- `otp_codes` — bcrypt-hashed code, identifier_hash, purpose enum, expires_at, attempts, consumed.
- `sessions` — sha256(refresh_token), user_id, device_label (UA), expires_at.

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

## Current phase

**Phase 1 — Email signup + accounts (complete).**
- Drizzle schema + tRPC routers (auth + me) wired through Fastify with cookies and CORS.
- Email OTP via Resend with dev console fallback.
- Backup PIN UI with Argon2id-derived AES-GCM encryption of the identity key.
- Welcome / Email signup (3-step wizard) / Login / Chats (post-auth landing) screens.
- Server gracefully degrades when env vars are missing — tells the user exactly what's missing.

## Next phase

**Phase 2 — Connections (invite + approval).** Adds prekey bundles, invites, connection_requests, connections tables; QR + invite-link flow; mutual approval.

## User preferences

- User manages their own database (Neon) and all third-party API keys; will store them in `.env` files. Do not provision external services for them or use platform-managed keys.
- Build phase-by-phase per the plan in `attached_assets/Pasted-Veil-Complete-Finalized-Plan-Summary-...txt`.
