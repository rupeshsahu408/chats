/**
 * Per-file AES-GCM encryption for end-to-end encrypted media.
 *
 * Each blob gets a fresh 256-bit key + 96-bit IV. The key is never sent
 * to the server — it travels to the recipient inside a Signal-encrypted
 * chat-message envelope, alongside the server blob id.
 *
 * Wire format (the bytes the server stores):
 *   [12-byte IV] [ciphertext + 16-byte GCM tag]
 */

import { bytesToBase64, base64ToBytes } from "./crypto";

const IV_BYTES = 12;
const KEY_BYTES = 32;

export interface EncryptedBlob {
  /** Bytes that get uploaded as-is to the server. */
  ciphertext: Uint8Array;
  /** Base64 of the raw 32-byte AES-GCM key (sent inside an E2E message). */
  keyB64: string;
}

function toBuffer(view: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(view.byteLength);
  new Uint8Array(out).set(view);
  return out;
}

async function importKey(rawKey: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    toBuffer(rawKey),
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptBlob(plaintext: Uint8Array): Promise<EncryptedBlob> {
  const rawKey = crypto.getRandomValues(new Uint8Array(KEY_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await importKey(rawKey);
  const ctBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toBuffer(iv) },
    key,
    toBuffer(plaintext),
  );
  const ct = new Uint8Array(ctBuf);
  const out = new Uint8Array(IV_BYTES + ct.byteLength);
  out.set(iv, 0);
  out.set(ct, IV_BYTES);
  return { ciphertext: out, keyB64: bytesToBase64(rawKey) };
}

export async function decryptBlob(
  bytes: Uint8Array,
  keyB64: string,
): Promise<Uint8Array> {
  if (bytes.byteLength < IV_BYTES + 16) {
    throw new Error("Ciphertext too short to be a valid encrypted blob.");
  }
  const iv = bytes.subarray(0, IV_BYTES);
  const ct = bytes.subarray(IV_BYTES);
  const rawKey = base64ToBytes(keyB64);
  if (rawKey.byteLength !== KEY_BYTES) {
    throw new Error("Invalid media key length.");
  }
  const key = await importKey(rawKey);
  const ptBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toBuffer(iv) },
    key,
    toBuffer(ct),
  );
  return new Uint8Array(ptBuf);
}

/* ────────── helpers ────────── */

export function bytesToBase64Std(b: Uint8Array): string {
  return bytesToBase64(b);
}

export function base64ToBytesStd(s: string): Uint8Array {
  return base64ToBytes(s);
}
