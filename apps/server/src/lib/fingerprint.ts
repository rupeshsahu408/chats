import { createHash } from "node:crypto";

/**
 * Short, human-readable fingerprint of an Ed25519 public key.
 *
 * We take SHA-256 of the raw key and show the first 8 lowercase hex chars
 * — i.e. 32 bits, formatted as `xxxx-xxxx`. This is just for visual
 * identification; the safety-number style full comparison comes in Phase 3.
 */
export function fingerprintForPublicKey(pub: Buffer | Uint8Array): string {
  const h = createHash("sha256").update(pub).digest("hex").slice(0, 8);
  return `${h.slice(0, 4)}-${h.slice(4, 8)}`;
}
