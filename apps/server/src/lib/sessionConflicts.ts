import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../env.js";

/**
 * Helpers for the single-active-session login flow.
 *
 * We mint two kinds of HMAC-bound tokens here:
 *
 *  1. **Continuation nonce** — handed to the *new* device when its
 *     login is parked because another device is already signed in.
 *     The new device polls + later claims the session with this
 *     nonce. We store the SHA-256 of the nonce in
 *     `login_conflicts.continuation_nonce_hash` so even if the table
 *     is dumped, the raw nonce can't be replayed.
 *
 *  2. **Must-change-password token** — handed to a user whose account
 *     was previously "secured". They must redeem it at
 *     `auth.submitNewPasswordAfterSecure`. Stateless: signed JWT-ish
 *     payload with `userId`, `expiresAt`, HMAC tag.
 *
 * Both tokens have ~5 / 15 minute TTLs and are single-use (the
 * continuation nonce becomes invalid the moment we mark the conflict
 * row `consumed_at`).
 */

const CONTINUATION_TTL_MS = 5 * 60_000;
const MUST_CHANGE_TTL_MS = 15 * 60_000;

function key(prefix: string): Buffer {
  if (!env.JWT_SECRET) throw new Error("JWT_SECRET missing");
  return Buffer.from(`${prefix}:${env.JWT_SECRET}`);
}

/* ─────────── continuation nonce ─────────── */

export interface ContinuationToken {
  nonce: string;
  hash: string;
  expiresAt: Date;
}

/**
 * Mint a new continuation nonce for `userId`. Returns both the raw
 * nonce (sent to the new device) and the SHA-256 hash (stored in the
 * DB so we can look it up without keeping the raw value).
 */
export function mintContinuationNonce(userId: string): ContinuationToken {
  const id = randomBytes(18).toString("base64url");
  const expiresAt = Date.now() + CONTINUATION_TTL_MS;
  const payload = `${id}.${expiresAt}.${userId}`;
  const sig = createHmac("sha256", key("login-continuation"))
    .update(payload)
    .digest("base64url");
  const nonce = `${payload}.${sig}`;
  const hash = createHash("sha256").update(nonce).digest("hex");
  return {
    nonce,
    hash,
    expiresAt: new Date(expiresAt),
  };
}

/**
 * Verify the cryptographic shape of a continuation nonce. Does NOT
 * check the DB row — call sites must look it up by hash and ensure
 * it's `pending`/`accepted` and not `consumed_at`.
 */
export function verifyContinuationNonce(
  nonce: string,
): { userId: string; hash: string } | null {
  if (typeof nonce !== "string") return null;
  const lastDot = nonce.lastIndexOf(".");
  if (lastDot < 0) return null;
  const payload = nonce.slice(0, lastDot);
  const sig = nonce.slice(lastDot + 1);
  const expected = createHmac("sha256", key("login-continuation"))
    .update(payload)
    .digest("base64url");
  let sigOk = false;
  try {
    const a = Buffer.from(sig, "base64url");
    const b = Buffer.from(expected, "base64url");
    sigOk = a.length === b.length && timingSafeEqual(a, b);
  } catch {
    sigOk = false;
  }
  if (!sigOk) return null;
  const [, expStr, userId] = payload.split(".");
  if (!expStr || !userId) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= Date.now()) return null;
  const hash = createHash("sha256").update(nonce).digest("hex");
  return { userId, hash };
}

export function continuationTtlSeconds(): number {
  return Math.floor(CONTINUATION_TTL_MS / 1000);
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
  let sigOk = false;
  try {
    const a = Buffer.from(sig, "base64url");
    const b = Buffer.from(expected, "base64url");
    sigOk = a.length === b.length && timingSafeEqual(a, b);
  } catch {
    sigOk = false;
  }
  if (!sigOk) return null;
  const [, expStr, userId] = payload.split(".");
  if (!expStr || !userId) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= Date.now()) return null;
  return userId;
}

/** Convenience for hashing a continuation nonce we already have. */
export function hashNonce(nonce: string): string {
  return createHash("sha256").update(nonce).digest("hex");
}
