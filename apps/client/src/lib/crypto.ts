import { ed25519 } from "@noble/curves/ed25519.js";
import { argon2id } from "hash-wasm";
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist as englishWordlist } from "@scure/bip39/wordlists/english.js";

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

/** Sign a message with the identity Ed25519 private key. Returns 64-byte signature. */
export function signWithIdentity(
  privateKey: Uint8Array,
  message: Uint8Array,
): Uint8Array {
  return ed25519.sign(message, privateKey);
}

/** Verify an Ed25519 signature. */
export function verifyWithIdentity(
  publicKey: Uint8Array,
  message: Uint8Array,
  signature: Uint8Array,
): boolean {
  try {
    return ed25519.verify(signature, message, publicKey);
  } catch {
    return false;
  }
}

/** Short fingerprint of a 32-byte public key: 8 hex chars formatted xxxx-xxxx. */
export async function publicKeyFingerprint(
  publicKey: Uint8Array,
): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", bs(publicKey));
  const bytes = new Uint8Array(hash);
  let hex = "";
  for (let i = 0; i < 4; i++) hex += bytes[i]!.toString(16).padStart(2, "0");
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
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

/* ─────────── BIP-39 Recovery Phrase (Phase 4 — Random ID accounts) ─────────── */

/** Generate a 12-word BIP-39 mnemonic. */
export function generateRecoveryPhrase(): string {
  return generateMnemonic(englishWordlist, 128); // 128 bits → 12 words
}

/** Check a mnemonic is valid BIP-39. */
export function isValidRecoveryPhrase(phrase: string): boolean {
  return validateMnemonic(phrase.trim().toLowerCase(), englishWordlist);
}

/**
 * Deterministically derive an Ed25519 identity keypair from a BIP-39 mnemonic.
 * The private key is the first 32 bytes of the BIP-39 seed (PBKDF2-SHA512).
 * Same phrase → same keypair, always.
 */
export function deriveIdentityFromPhrase(phrase: string): IdentityKeyPair {
  const seed = mnemonicToSeedSync(phrase.trim().toLowerCase());
  const privateKey = seed.slice(0, 32);
  const publicKey = ed25519.getPublicKey(privateKey);
  return {
    privateKey: Uint8Array.from(privateKey),
    publicKey: Uint8Array.from(publicKey),
  };
}

/**
 * Deterministically derive an X25519 keypair from a BIP-39 mnemonic.
 * Uses bytes 32-63 of the BIP-39 seed as the private key.
 */
export function deriveX25519FromPhrase(phrase: string): { privateKey: Uint8Array; publicKey: Uint8Array } {
  const seed = mnemonicToSeedSync(phrase.trim().toLowerCase());
  const privateKey = Uint8Array.from(seed.slice(32, 64));
  return { privateKey, publicKey: new Uint8Array(0) }; // publicKey computed by caller
}

/** Sign a string message with an Ed25519 private key. Returns base64 signature. */
export function signMessage(privateKey: Uint8Array, message: string): string {
  const msgBytes = new TextEncoder().encode(message);
  const sig = ed25519.sign(msgBytes, privateKey);
  return bytesToBase64(sig);
}

/** Generate a random veil_xxxxxxxx user ID. */
export function generateRandomId(): string {
  const bytes = randomBytes(4);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `veil_${hex}`;
}
