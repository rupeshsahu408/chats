/**
 * Safety numbers — Signal-style numeric fingerprint pair derived from
 * both peers' identity public keys. Two devices that compute the same
 * safety number for the same conversation can be confident they're
 * talking to each other and not a man-in-the-middle.
 *
 * The number is rendered as 12 groups of 5 digits (60 digits total),
 * which makes side-by-side reading easy without losing entropy.
 */

import { base64ToBytes } from "./crypto";

const VERSION = 0; // bump if we change the format
const ITERATIONS = 5200;

function bs(a: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(a.length));
  out.set(a);
  return out;
}

function sortedConcat(a: Uint8Array, b: Uint8Array): Uint8Array {
  // Lex-compare so both peers derive the same input regardless of order.
  let cmp = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      cmp = a[i]! < b[i]! ? -1 : 1;
      break;
    }
  }
  if (cmp === 0) cmp = a.length - b.length;
  const [first, second] = cmp <= 0 ? [a, b] : [b, a];
  const out = new Uint8Array(first.length + second.length);
  out.set(first, 0);
  out.set(second, first.length);
  return out;
}

async function sha512(input: Uint8Array): Promise<Uint8Array> {
  const buf = await crypto.subtle.digest("SHA-512", bs(input));
  return new Uint8Array(buf);
}

function chunk5(bytes: Uint8Array): string {
  // Take 5 bytes → format as a 5-digit decimal (mod 100000), repeat.
  let out = "";
  for (let i = 0; i + 5 <= bytes.length && out.length < 60; i += 5) {
    let v = 0n;
    for (let j = 0; j < 5; j++) v = (v << 8n) | BigInt(bytes[i + j]!);
    const five = (v % 100000n).toString().padStart(5, "0");
    out += five;
    if (out.length >= 60) break;
  }
  return out.slice(0, 60);
}

function format60(digits: string): string {
  return digits.replace(/(\d{5})(?=\d)/g, "$1 ");
}

/**
 * Compute the formatted 12×5-digit safety number for two parties given
 * their raw identity public keys.
 */
export async function computeSafetyNumber(
  myPublicKey: Uint8Array,
  peerPublicKey: Uint8Array,
): Promise<string> {
  const versionBytes = new Uint8Array([
    (VERSION >> 8) & 0xff,
    VERSION & 0xff,
  ]);
  let h = await sha512(
    new Uint8Array([...versionBytes, ...sortedConcat(myPublicKey, peerPublicKey)]),
  );
  for (let i = 1; i < ITERATIONS; i++) h = await sha512(h);
  return format60(chunk5(h));
}

/** Convenience: take base64 keys and return the formatted number. */
export async function safetyNumberFromB64(
  myPubB64: string,
  peerPubB64: string,
): Promise<string> {
  return computeSafetyNumber(
    base64ToBytes(myPubB64),
    base64ToBytes(peerPubB64),
  );
}
