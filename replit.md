# Veil

> Private by design. Visible to no one but you.

A Progressive Web App messenger — end-to-end encrypted, open-source, no ads, no tracking.

## Repo layout (pnpm monorepo)

```
veil/
├── apps/
│   ├── client/        React 18 + Vite + TS + Tailwind PWA (port 5000)
│   └── server/        Fastify + TS backend (port 3001)
├── packages/
│   └── shared/        Shared TS types & zod schemas
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

## Local dev

- `pnpm dev` — runs client + server concurrently via `concurrently`.
- Client: http://localhost:5000 (bound to 0.0.0.0, all hosts allowed for Replit iframe proxy).
- Server: http://localhost:3001, health check at `/health`.
- Vite dev proxy: `/api/*` → `http://127.0.0.1:3001/*` (rewrites away the `/api` prefix).

## Workflow

A single Replit workflow named **`Start application`** runs `pnpm dev` and waits on port 5000 (webview).

## Environment / secrets

- The user manages all third-party secrets themselves (Neon, Resend, Firebase, etc.).
- `.env` files live next to each app (`apps/client/.env`, `apps/server/.env`).
- Frontend env vars must be `VITE_`-prefixed.
- Examples shipped: `apps/client/.env.example`, `apps/server/.env.example`.
- `.env` files are git-ignored.

## Stack (full plan, by phase)

- **Frontend:** React 18 + Vite + TS + Tailwind + shadcn/ui (Phase 1+) + Zustand + Dexie + react-router-dom + react-hook-form + zod + framer-motion + vite-plugin-pwa + qrcode/qr-scanner.
- **Backend:** Node + Fastify + TS + Drizzle + tRPC (Phase 1+) + WebSocket relay (Phase 3).
- **Crypto (device-side):** @signalapp/libsignal-client (1:1), MLS (groups, Phase 7), Web Crypto, argon2-browser, bip39.
- **Data:** Neon Postgres, Upstash Redis, Cloudflare R2 (media).
- **Auth/notifications:** Resend (email OTP), Firebase (SMS OTP), Web Push / FCM / APNs.
- **Hosting:** Vercel (frontend) + Render (backend) target deployment; Replit during development.

## Current phase

**Phase 0 — Foundation Setup (complete).** Empty deployable shell:
- Monorepo + pnpm workspaces wired up.
- Client renders a Veil landing page with PWA manifest + service worker (installable on Android Chrome / desktop).
- Server exposes `GET /health` returning `{ status: "ok", service, version, timestamp }`.
- Landing page calls `/api/health` on load and shows live server status.
- Tailwind theme: deep midnight blue (`#0b1437`) + soft white + violet accent (`#7c5cff`) — distinct from WhatsApp green.
- Privacy-aware pino logger (auth/cookie headers redacted).
- CORS configured (Replit dev domains in dev; explicit allow-list via `CORS_ORIGIN` in prod).
- Typecheck + production builds (`pnpm typecheck`, `pnpm build`) both green.

## Next phase

**Phase 1 — Email signup + account system.** Will add Neon Postgres + Drizzle schema, Resend email OTP, JWT/refresh sessions, Backup PIN, Signal identity keypair generation on device. Requires user to provision: `DATABASE_URL` (Neon), `RESEND_API_KEY`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `IDENTIFIER_HMAC_PEPPER`.

## User preferences

- User manages their own database (Neon) and all third-party API keys; will store them in `.env` files. Do not provision external services for them or use platform-managed keys.
- Build phase-by-phase per the plan in `attached_assets/Pasted-Veil-Complete-Finalized-Plan-Summary-...txt`.
