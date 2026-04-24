import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../env.js";

/**
 * Short-lived, HMAC-bound challenge nonces for the recovery-key
 * password reset flow.
 *
 *   - `auth.beginPasswordReset` issues a nonce bound to a username
 *     and a single-use token id. Even unknown usernames get a
 *     challenge to avoid enumeration via timing or status codes.
 *   - The client signs the nonce with the Ed25519 private key it
 *     derived from the user's BIP-39 recovery phrase.
 *   - `auth.completePasswordReset` verifies the signature against
 *     the `users.identity_pubkey` we stored at signup, then resets
 *     the password.
 *
 * The recovery phrase itself never leaves the device.
 */

const TTL_MS = 5 * 60 * 1000; // 5 minutes — generous for a password reset

interface PendingReset {
  username: string;
  expiresAt: number;
}

const pending = new Map<string, PendingReset>();

function gc(): void {
  const now = Date.now();
  for (const [id, row] of pending) {
    if (row.expiresAt <= now) pending.delete(id);
  }
}

function key(): Buffer {
  if (!env.JWT_SECRET) throw new Error("JWT_SECRET missing");
  return Buffer.from(`password-reset:${env.JWT_SECRET}`);
}

/**
 * Issue a one-shot reset nonce for `username`. The full nonce string
 * is `<id>.<expiresAt>.<usernameHashB64>.<sig>`; only the id half is
 * persisted server-side, the rest is HMAC-bound so a tampered nonce
 * fails consume.
 */
export function issueResetChallenge(username: string): {
  nonce: string;
  expiresInSeconds: number;
} {
  gc();
  const id = randomBytes(16).toString("base64url");
  const expiresAt = Date.now() + TTL_MS;
  pending.set(id, { username, expiresAt });

  // Bind username to the signed payload so we can detect tampering
  // before doing any DB lookup on consume.
  const usernameTag = createHmac("sha256", key())
    .update(`u:${username}`)
    .digest("base64url");

  const payload = `${id}.${expiresAt}.${usernameTag}`;
  const sig = createHmac("sha256", key()).update(payload).digest("base64url");
  return {
    nonce: `${payload}.${sig}`,
    expiresInSeconds: Math.floor(TTL_MS / 1000),
  };
}

/**
 * Validate a nonce previously returned from `issueResetChallenge`,
 * mark it consumed, and return the bound username. Returns `null`
 * for any failure mode (unknown id, expired, tampered, already used).
 */
export function consumeResetChallenge(nonce: string): string | null {
  if (typeof nonce !== "string") return null;
  const lastDot = nonce.lastIndexOf(".");
  if (lastDot < 0) return null;
  const payload = nonce.slice(0, lastDot);
  const sig = nonce.slice(lastDot + 1);

  const expected = createHmac("sha256", key())
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

  const [id, expStr, usernameTag] = payload.split(".");
  if (!id || !expStr || !usernameTag) return null;

  const row = pending.get(id);
  if (!row) return null;
  pending.delete(id);

  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;

  // Re-derive the username tag and compare to defend against a leaked
  // id being paired with a different username field.
  const expectedTag = createHmac("sha256", key())
    .update(`u:${row.username}`)
    .digest("base64url");
  if (expectedTag !== usernameTag) return null;

  return row.username;
}
