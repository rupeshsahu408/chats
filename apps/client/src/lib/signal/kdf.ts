/**
 * HKDF + HMAC primitives, all SHA-256, via WebCrypto.
 */

const enc = new TextEncoder();

export async function hkdf(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: string | Uint8Array,
  byteLength: number,
): Promise<Uint8Array> {
  const ikmBytes = ikm.byteOffset === 0 ? ikm : new Uint8Array(ikm);
  const baseKey = await crypto.subtle.importKey(
    "raw",
    ikmBytes as BufferSource,
    { name: "HKDF" },
    false,
    ["deriveBits"],
  );
  const infoBytes = typeof info === "string" ? enc.encode(info) : info;
  const bits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: salt as BufferSource,
      info: infoBytes as BufferSource,
    },
    baseKey,
    byteLength * 8,
  );
  return new Uint8Array(bits);
}

export async function hmacSha256(
  key: Uint8Array,
  data: Uint8Array,
): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, data as BufferSource);
  return new Uint8Array(sig);
}

/** Concatenate any number of byte arrays into a fresh Uint8Array. */
export function concatBytes(...arrs: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const a of arrs) total += a.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}
