import { createHmac, createHash } from "node:crypto";
import { env } from "../env.js";

/**
 * HMAC-SHA256 of a normalised identifier (email/phone) using the server pepper.
 * Returns a hex string. Same input → same output, but the raw value is never
 * stored or recoverable from the hash without the pepper.
 */
export function hashIdentifier(identifier: string): string {
  if (!env.IDENTIFIER_HMAC_PEPPER) {
    throw new Error("IDENTIFIER_HMAC_PEPPER is not configured");
  }
  return createHmac("sha256", env.IDENTIFIER_HMAC_PEPPER)
    .update(identifier.trim().toLowerCase())
    .digest("hex");
}

/** SHA-256 hex digest of an arbitrary string (used for refresh-token storage). */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Pepper-free discovery hash for a phone number. The client computes the
 * same value (without needing access to the server pepper), so we can do
 * `HMAC(rotating_salt, phoneShaHex)` on both sides and compare.
 *
 *   phoneSha = SHA256("phone:" + lowercase(E.164)) (hex)
 */
export function phoneDiscoverySha(phoneE164: string): string {
  return createHash("sha256")
    .update(`phone:${phoneE164.trim().toLowerCase()}`)
    .digest("hex");
}
