import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import type { FastifyTRPCPluginOptions } from "@trpc/server/adapters/fastify";
import { env, isDev, missingAuthConfig } from "./env.js";
import type { HealthResponse } from "@veil/shared";
import { appRouter, type AppRouter } from "./trpc/routers/index.js";
import { createContext } from "./trpc/context.js";
import { registerWebSocketRoutes } from "./lib/wsServer.js";
import { initPush } from "./lib/push.js";
import { startMediaSweeper } from "./lib/mediaSweeper.js";
import { startMessageSweeper } from "./lib/messageSweeper.js";
import { startScheduledSweeper } from "./lib/scheduledSweeper.js";

const app = Fastify({
  trustProxy: true,
  // Encrypted media now uploads directly to R2 via presigned URLs, so the
  // server only ever sees small JSON envelopes again.
  bodyLimit: 1 * 1024 * 1024,
  logger: isDev
    ? {
        level: "info",
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss" },
        },
        redact: {
          paths: ["req.headers.authorization", "req.headers.cookie"],
          remove: true,
        },
      }
    : {
        level: "info",
        redact: {
          paths: ["req.headers.authorization", "req.headers.cookie"],
          remove: true,
        },
      },
});

/**
 * Match an origin against an allow-list entry.
 * Supports exact matches and `*` as a hostname wildcard, e.g.
 *   https://*.vercel.app          → any Vercel subdomain over https
 *   https://chats-*.vercel.app    → any chats-* preview on Vercel
 *   *                              → allow any origin (use with care)
 */
function originMatches(origin: string, pattern: string): boolean {
  if (pattern === "*") return true;
  if (pattern === origin) return true;
  if (!pattern.includes("*")) return false;
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, "[^/]*");
  return new RegExp(`^${escaped}$`).test(origin);
}

/**
 * Built-in trusted client-hosting hostname patterns. These are always allowed
 * (in addition to anything in CORS_ORIGIN) so the API "just works" when the
 * client is deployed to a common static host without requiring per-deploy env
 * configuration. Set CORS_STRICT=true to disable these defaults.
 */
const TRUSTED_CLIENT_HOST_PATTERNS = [
  /\.vercel\.app$/,        // Vercel production + previews
  /\.netlify\.app$/,       // Netlify production + previews
  /\.pages\.dev$/,         // Cloudflare Pages
  /\.onrender\.com$/,      // Render static sites
  /\.replit\.app$/,        // Replit deployments
  /\.replit\.dev$/,        // Replit dev
  /\.repl\.co$/,           // Replit (legacy)
];

const corsStrict = process.env.CORS_STRICT === "true";

await app.register(cors, {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const allowList = env.CORS_ORIGIN.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (allowList.some((pattern) => originMatches(origin, pattern))) {
      return cb(null, true);
    }
    let host = "";
    try {
      host = new URL(origin).hostname;
    } catch {
      // origin wasn't a valid URL — fall through to rejection
    }
    if (host) {
      if (isDev && (host === "localhost" || host === "127.0.0.1")) {
        return cb(null, true);
      }
      if (!corsStrict && TRUSTED_CLIENT_HOST_PATTERNS.some((re) => re.test(host))) {
        return cb(null, true);
      }
    }
    app.log.warn({ origin, allowList, corsStrict }, "CORS origin rejected");
    cb(new Error(`Origin not allowed: ${origin}`), false);
  },
  credentials: true,
});

await app.register(cookie);

await registerWebSocketRoutes(app);

app.get("/health", async (): Promise<HealthResponse> => {
  return {
    status: "ok",
    service: "veil-server",
    version: "0.0.0",
    timestamp: new Date().toISOString(),
  };
});

await app.register(fastifyTRPCPlugin, {
  prefix: "/trpc",
  trpcOptions: {
    router: appRouter,
    createContext,
    onError({ path, error }) {
      const cause = error.cause as Record<string, unknown> | undefined;
      app.log.error(
        {
          path,
          code: error.code,
          msg: error.message,
          cause: cause
            ? {
                pgCode: cause["code"],
                pgMsg: cause["message"],
                pgDetail: cause["detail"],
                pgConstraint: cause["constraint"],
              }
            : undefined,
        },
        "tRPC error",
      );
    },
  } satisfies FastifyTRPCPluginOptions<AppRouter>["trpcOptions"],
});

const missing = missingAuthConfig();
if (missing.length > 0) {
  app.log.warn(
    `Auth endpoints disabled until you set: ${missing.join(", ")}. ` +
      `See apps/server/.env.example.`,
  );
}
if (!env.RESEND_API_KEY && isDev) {
  app.log.warn(
    "RESEND_API_KEY not set — OTP codes will be logged to this console (dev only).",
  );
}

initPush(app.log);
startMediaSweeper(app.log);
startMessageSweeper(app.log);
startScheduledSweeper(app.log);

try {
  await app.listen({ host: env.HOST, port: env.PORT });
  app.log.info(`veil-server listening on http://${env.HOST}:${env.PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
