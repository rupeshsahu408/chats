# Veil

> Private by design. Visible to no one but you.

A Progressive Web App messenger — end-to-end encrypted, open-source, no ads, no tracking.

## Monorepo layout

```
veil/
├── apps/
│   ├── client/        React + Vite PWA
│   └── server/        Node + Fastify backend
├── packages/
│   └── shared/        Shared TypeScript types & zod schemas
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

## Local development

```bash
pnpm install
pnpm dev
```

- Client: http://localhost:5000
- Server health check: http://localhost:3001/health
- Vite proxies `/api/*` → server.

## Environment variables

Each app reads its own `.env` file (see `.env.example` in each app folder).
Secrets are never committed.

## License

MIT
