import Fastify from "fastify";
import cors from "@fastify/cors";
import { env, isDev } from "./env.js";
import type { HealthResponse } from "@veil/shared";

const app = Fastify({
  logger: isDev
    ? {
        level: "info",
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss" },
        },
        // Privacy-aware: never log request bodies/headers by default.
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
  disableRequestLogging: false,
});

await app.register(cors, {
  origin: (origin, cb) => {
    // No origin (curl, server-to-server) → allow.
    if (!origin) return cb(null, true);

    // Allow configured origins.
    const allowList = env.CORS_ORIGIN.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (allowList.includes(origin)) return cb(null, true);

    // In dev, allow all Replit dev domains and localhost.
    if (isDev) {
      if (
        /\.replit\.dev$/.test(new URL(origin).hostname) ||
        /\.repl\.co$/.test(new URL(origin).hostname) ||
        /^localhost$/.test(new URL(origin).hostname) ||
        /^127\.0\.0\.1$/.test(new URL(origin).hostname)
      ) {
        return cb(null, true);
      }
    }

    cb(new Error(`Origin not allowed: ${origin}`), false);
  },
  credentials: true,
});

app.get("/health", async (): Promise<HealthResponse> => {
  return {
    status: "ok",
    service: "veil-server",
    version: "0.0.0",
    timestamp: new Date().toISOString(),
  };
});

try {
  await app.listen({ host: env.HOST, port: env.PORT });
  app.log.info(`veil-server listening on http://${env.HOST}:${env.PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
