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

await app.register(cors, {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const allowList = env.CORS_ORIGIN.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (allowList.includes(origin)) return cb(null, true);
    if (isDev) {
      try {
        const host = new URL(origin).hostname;
        if (
          /\.replit\.dev$/.test(host) ||
          /\.repl\.co$/.test(host) ||
          host === "localhost" ||
          host === "127.0.0.1"
        ) {
          return cb(null, true);
        }
      } catch {
        // fall through
      }
    }
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
      app.log.error({ path, code: error.code, msg: error.message }, "tRPC error");
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

try {
  await app.listen({ host: env.HOST, port: env.PORT });
  app.log.info(`veil-server listening on http://${env.HOST}:${env.PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
