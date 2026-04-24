import { argon2id } from "hash-wasm";
import { bytesToBase64, base64ToBytes, randomBytes } from "./crypto";

/**
 * Backup PIN for the Vault — used either as the only unlock method on
 * devices without WebAuthn (Linux desktops, older browsers, no Touch ID
 * / Windows Hello) or as a recovery fallback if biometrics fail.
 *
 * We hash the PIN with Argon2id (the same KDF the rest of the app uses
 * for at-rest key derivation) and store both the hash and the random
 * salt in `userPrefs`. Verification re-derives and constant-time
 * compares the bytes.
 *
 * The PIN is never sent to the server and never leaves the device.
 */

const ARGON2_OPTS = {
  iterations: 3,
  parallelism: 1,
  memorySize: 64 * 1024,
  hashLength: 32,
};

export interface VaultPinHash {
  /** base64-encoded 32-byte Argon2id output. */
  hash: string;
  /** base64-encoded 16-byte random salt. */
  salt: string;
}

/** Hash a PIN with a fresh random salt. Returns the values to persist. */
export async function hashVaultPin(pin: string): Promise<VaultPinHash> {
  const saltBytes = randomBytes(16);
  const raw = await argon2id({
    password: pin,
    salt: saltBytes,
    ...ARGON2_OPTS,
    outputType: "binary",
  });
  return {
    hash: bytesToBase64(raw as Uint8Array),
    salt: bytesToBase64(saltBytes),
  };
}

/** Verify a candidate PIN against a stored hash + salt. */
export async function verifyVaultPin(
  pin: string,
  storedHash: string,
  storedSalt: string,
): Promise<boolean> {
  const saltBytes = base64ToBytes(storedSalt);
  const raw = (await argon2id({
    password: pin,
    salt: saltBytes,
    ...ARGON2_OPTS,
    outputType: "binary",
  })) as Uint8Array;
  const expected = base64ToBytes(storedHash);
  if (raw.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < raw.length; i++) diff |= raw[i]! ^ expected[i]!;
  return diff === 0;
}
