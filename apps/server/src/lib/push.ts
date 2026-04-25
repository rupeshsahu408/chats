import webpush from "web-push";
import type { FastifyBaseLogger } from "fastify";
import { eq, inArray } from "drizzle-orm";
import { env, isDev } from "../env.js";
import { getDb, schema } from "../db/index.js";

let configured = false;
let publicKey: string | null = null;

/**
 * Configure web-push with VAPID keys.
 *
 * In production, both keys must be supplied via env vars (so they're
 * stable across restarts and across multiple instances). In dev, if
 * either is missing we generate an ephemeral pair and log it so the
 * developer can copy it into their .env to make pushes survive a
 * server restart.
 */
export function initPush(log: FastifyBaseLogger): void {
  let pub = env.VAPID_PUBLIC_KEY;
  let priv = env.VAPID_PRIVATE_KEY;

  if (!pub || !priv) {
    if (!isDev) {
      log.warn(
        "VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not configured — Web Push notifications will be disabled.",
      );
      configured = false;
      return;
    }
    const generated = webpush.generateVAPIDKeys();
    pub = generated.publicKey;
    priv = generated.privateKey;
    log.warn(
      `Generated ephemeral VAPID keys (dev only).\n` +
        `  VAPID_PUBLIC_KEY=${pub}\n` +
        `  VAPID_PRIVATE_KEY=${priv}\n` +
        `Add these to apps/server/.env to make push subscriptions survive restarts.`,
    );
  }

  webpush.setVapidDetails(env.VAPID_SUBJECT, pub, priv);
  publicKey = pub;
  configured = true;
}

export function getPublicKey(): string | null {
  return publicKey;
}

export function isPushConfigured(): boolean {
  return configured;
}

export interface VeilPushPayload {
  /** What kind of event triggered this push. */
  type: "new_message" | "chat_request";
  /** Generic non-leaking title shown if the SW can't decrypt. */
  title?: string;
  /** Generic non-leaking body. Never the actual message text. */
  body?: string;
  /** Used by the SW to deep-link / focus an existing chat tab. */
  url?: string;
}

/**
 * Fan out a Web Push notification to every subscription registered for
 * `userId`. Stale subscriptions (404 / 410) are pruned automatically.
 */
export async function pushToUser(
  userId: string,
  payload: VeilPushPayload,
  log?: FastifyBaseLogger,
): Promise<void> {
  if (!configured) return;
  const db = getDb();
  const subs = await db
    .select()
    .from(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.userId, userId));
  if (subs.length === 0) return;

  const body = JSON.stringify(payload);
  const dead: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          body,
          { TTL: 60, urgency: "high" },
        );
      } catch (err: unknown) {
        const statusCode =
          (err as { statusCode?: number }).statusCode ?? 0;
        if (statusCode === 404 || statusCode === 410) {
          dead.push(s.id);
        } else if (log) {
          log.warn(
            { err, endpoint: s.endpoint.slice(0, 40) },
            "web-push send failed",
          );
        }
      }
    }),
  );

  if (dead.length > 0) {
    await db
      .delete(schema.pushSubscriptions)
      .where(inArray(schema.pushSubscriptions.id, dead));
  }
}
