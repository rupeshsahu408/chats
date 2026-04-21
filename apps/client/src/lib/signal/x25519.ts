import { x25519 } from "@noble/curves/ed25519.js";

/**
 * Thin wrapper around @noble/curves' x25519 so the rest of the codebase
 * doesn't depend on the import path. All inputs/outputs are 32-byte
 * Uint8Arrays.
 */

export interface X25519KeyPair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}

export function generateX25519KeyPair(): X25519KeyPair {
  const kp = x25519.keygen();
  return { privateKey: kp.secretKey, publicKey: kp.publicKey };
}

export function x25519PublicKeyFromPrivate(
  privateKey: Uint8Array,
): Uint8Array {
  return x25519.getPublicKey(privateKey);
}

export function x25519DH(
  ourPrivate: Uint8Array,
  theirPublic: Uint8Array,
): Uint8Array {
  return x25519.getSharedSecret(ourPrivate, theirPublic);
}
