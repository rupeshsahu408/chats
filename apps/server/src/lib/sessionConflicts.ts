import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../env.js";

/**
 * Helpers for the single-active-session login flow.
 *
 * All tokens here are stateless HMAC payloads — we never persist
 * them server-side. Two flavours are minted:
 *
 *  1. **Pending-login token** — handed to the *new* device when its
 *     login is parked because another device is already signed in.
 *     The new device then either calls `auth.confirmReplaceSession`
 *     (kick the other device out + sign in) or
 *     `auth.rejectLoginAttempt` (drop the attempt + alert the
 *     existing device). The token bundles the requester's
 *     `userId`, fingerprint, IP prefix, device label, city, and
 *     country so the follow-up endpoints don't need a DB row.
 *
 *  2. **Must-change-password token** — handed to a user whose
 *     account was previously "secured". They must redeem it at
 *     `auth.submitNewPasswordAfterSecure`.
 *
 * Both tokens have ~5 / 15 minute TTLs and are single-use in the
 * "tied to current account state" sense — once the user-state
 * transition behind them happens (session created, password reset,
 * etc.), replays are rejected by the endpoint logic.
 */

const PENDING_LOGIN_TTL_MS = 5 * 60_000;
const MUST_CHANGE_TTL_MS = 15 * 60_000;

function key(prefix: string): Buffer {
  if (!env.JWT_SECRET) throw new Error("JWT_SECRET missing");
  return Buffer.from(`${prefix}:${env.JWT_SECRET}`);
}

function safeEqual(a: string, b: string): boolean {
  try {
    const aB = Buffer.from(a, "base64url");
    const bB = Buffer.from(b, "base64url");
    return aB.length === bB.length && timingSafeEqual(aB, bB);
  } catch {
    return false;
  }
}

/* ─────────── pending-login token ─────────── */

export interface PendingLoginPayload {
  userId: string;
  /** Stable fingerprint of the requester's user-agent. */
  requesterFp: string;
  /** /24 (v4) or /48 (v6) prefix of the requester's IP. May be null. */
  requesterIpPrefix: string | null;
  /** Human-friendly device label ("Chrome on macOS"). */
  requesterDevice: string;
  requesterCity: string | null;
  requesterCountry: string | null;
}

/**
 * Encode the payload as a single base64url JSON blob inside a
 * `<id>.<expiresAt>.<payloadJsonB64>.<sig>` token.
 */
export function mintPendingLoginToken(
  payload: PendingLoginPayload,
): { token: string; expiresInSeconds: number; expiresAt: Date } {
  const id = randomBytes(12).toString("base64url");
  const expiresAt = Date.now() + PENDING_LOGIN_TTL_MS;
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const body = `${id}.${expiresAt}.${payloadB64}`;
  const sig = createHmac("sha256", key("pending-login"))
    .update(body)
    .digest("base64url");
  return {
    token: `${body}.${sig}`,
    expiresInSeconds: Math.floor(PENDING_LOGIN_TTL_MS / 1000),
    expiresAt: new Date(expiresAt),
  };
}

export function verifyPendingLoginToken(
  token: string,
): PendingLoginPayload | null {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [id, expStr, payloadB64, sig] = parts;
  if (!id || !expStr || !payloadB64 || !sig) return null;
  const body = `${id}.${expStr}.${payloadB64}`;
  const expected = createHmac("sha256", key("pending-login"))
    .update(body)
    .digest("base64url");
  if (!safeEqual(sig, expected)) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= Date.now()) return null;
  try {
    const json = Buffer.from(payloadB64, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as PendingLoginPayload;
    if (
      typeof parsed?.userId !== "string" ||
      typeof parsed?.requesterFp !== "string" ||
      typeof parsed?.requesterDevice !== "string"
    ) {
      return null;
    }
    return {
      userId: parsed.userId,
      requesterFp: parsed.requesterFp,
      requesterIpPrefix: parsed.requesterIpPrefix ?? null,
      requesterDevice: parsed.requesterDevice,
      requesterCity: parsed.requesterCity ?? null,
      requesterCountry: parsed.requesterCountry ?? null,
    };
  } catch {
    return null;
  }
}

export function pendingLoginTtlSeconds(): number {
  return Math.floor(PENDING_LOGIN_TTL_MS / 1000);
}

/* ─────────── must-change-password token ─────────── */

export function mintMustChangeToken(userId: string): {
  token: string;
  expiresInSeconds: number;
} {
  const id = randomBytes(12).toString("base64url");
  const expiresAt = Date.now() + MUST_CHANGE_TTL_MS;
  const payload = `${id}.${expiresAt}.${userId}`;
  const sig = createHmac("sha256", key("must-change"))
    .update(payload)
    .digest("base64url");
  return {
    token: `${payload}.${sig}`,
    expiresInSeconds: Math.floor(MUST_CHANGE_TTL_MS / 1000),
  };
}

export function verifyMustChangeToken(token: string): string | null {
  if (typeof token !== "string") return null;
  const lastDot = token.lastIndexOf(".");
  if (lastDot < 0) return null;
  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  const expected = createHmac("sha256", key("must-change"))
    .update(payload)
    .digest("base64url");
  if (!safeEqual(sig, expected)) return null;
  const [, expStr, userId] = payload.split(".");
  if (!expStr || !userId) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= Date.now()) return null;
  return userId;
}
