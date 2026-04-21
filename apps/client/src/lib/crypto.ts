import { ed25519 } from "@noble/curves/ed25519.js";
import { argon2id } from "hash-wasm";

/** Copy a Uint8Array into a fresh ArrayBuffer-backed view (safe for Web Crypto). */
function bs(a: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(a.length));
  out.set(a);
  return out;
}

/* ─────────── Identity keypair (Phase 1: Ed25519 placeholder) ─────────── */
/*
 * For Phase 3 we'll swap to the full Signal Protocol identity (X25519 +
 * Ed25519 signing, prekeys, etc.). For Phase 1 we just need a stable
 * device identity public key to associate with the account.
 */

export interface IdentityKeyPair {
  /** 32 bytes raw. */
  privateKey: Uint8Array;
  /** 32 bytes raw. */
  publicKey: Uint8Array;
}

export function generateIdentityKeyPair(): IdentityKeyPair {
  const privateKey = ed25519.utils.randomSecretKey();
  const publicKey = ed25519.getPublicKey(privateKey);
  return { privateKey, publicKey };
}

/* ─────────── PIN-derived key for at-rest encryption ─────────── */

const ARGON2_OPTS = {
  iterations: 3,
  parallelism: 1,
  memorySize: 64 * 1024, // 64 MB
  hashLength: 32,
};

export async function deriveKeyFromPin(
  pin: string,
  saltBytes: Uint8Array,
): Promise<CryptoKey> {
  const raw = await argon2id({
    password: pin,
    salt: saltBytes,
    ...ARGON2_OPTS,
    outputType: "binary",
  });
  return await crypto.subtle.importKey("raw", bs(raw), "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export function randomBytes(n: number): Uint8Array {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return a;
}

export interface EncryptedBlob {
  ciphertext: Uint8Array;
  iv: Uint8Array;
  salt: Uint8Array;
}

export async function encryptWithPin(
  pin: string,
  plaintext: Uint8Array,
): Promise<EncryptedBlob> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKeyFromPin(pin, salt);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: bs(iv) }, key, bs(plaintext)),
  );
  return { ciphertext: ct, iv, salt };
}

export async function decryptWithPin(
  pin: string,
  blob: EncryptedBlob,
): Promise<Uint8Array> {
  const key = await deriveKeyFromPin(pin, blob.salt);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bs(blob.iv) },
    key,
    bs(blob.ciphertext),
  );
  return new Uint8Array(pt);
}

/* ─────────── Base64 helpers ─────────── */

export function bytesToBase64(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]!);
  return btoa(s);
}

export function base64ToBytes(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
