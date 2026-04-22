/**
 * Phase 7 — Group chat sender-key crypto.
 *
 * Each (group, sender, epoch) has a 32-byte chain key. To encrypt
 * message n the sender derives msgKey = HMAC(chain, [0x01]) and then
 * advances chain ← HMAC(chain, [0x02]). Receivers track the same chain
 * per remote sender so they can reproduce the message key sequence.
 *
 * Out-of-order messages within an epoch are tolerated by caching up to
 * MAX_SKIPPED message keys per (group, sender, epoch). Anything older
 * than that (or from an epoch we no longer have a key for) is dropped.
 *
 * The chain keys themselves are never sent over the wire. They reach
 * other members through Sender Key Distribution Messages (SKDMs)
 * tunnelled through the existing 1:1 Double-Ratchet session with each
 * member.
 */

import { hmacSha256 } from "./kdf";
import { aesGcmDecrypt, aesGcmEncrypt, deriveAead } from "./aead";
import { bytesToBase64, base64ToBytes } from "../crypto";

const MAX_SKIPPED = 64;
const enc = new TextEncoder();
const dec = new TextDecoder();

function u32be(n: number): Uint8Array {
  const b = new Uint8Array(4);
  b[0] = (n >>> 24) & 0xff;
  b[1] = (n >>> 16) & 0xff;
  b[2] = (n >>> 8) & 0xff;
  b[3] = n & 0xff;
  return b;
}

export interface GroupHeader {
  gv: 1;
  gid: string;
  ep: number;
  sender: string;
  n: number;
}

export interface SenderKeyState {
  groupId: string;
  senderUserId: string;
  epoch: number;
  /** Base64 32-byte current chain key. */
  chainKey: string;
  /** Next counter to issue (sender) or expect (receiver). */
  n: number;
  /** Skipped message keys: { [counter]: base64 msgKey }. */
  skipped: Record<number, string>;
  updatedAt: string;
}

export function freshChainKey(): Uint8Array {
  const k = new Uint8Array(32);
  crypto.getRandomValues(k);
  return k;
}

async function deriveMessageKey(chain: Uint8Array): Promise<Uint8Array> {
  return await hmacSha256(chain, new Uint8Array([0x01]));
}

async function advanceChain(chain: Uint8Array): Promise<Uint8Array> {
  return await hmacSha256(chain, new Uint8Array([0x02]));
}

function encodeHeader(h: GroupHeader): { bytes: Uint8Array; b64: string } {
  const json = JSON.stringify(h);
  const bytes = enc.encode(json);
  return { bytes, b64: bytesToBase64(bytes) };
}

export function decodeGroupHeader(b64: string): {
  header: GroupHeader;
  bytes: Uint8Array;
} {
  const bytes = base64ToBytes(b64);
  const header = JSON.parse(dec.decode(bytes)) as GroupHeader;
  return { header, bytes };
}

/**
 * Encrypt a plaintext for a group as the local sender. Mutates the
 * passed `state` (advances chain, increments n) in place. Caller is
 * responsible for persisting the new state.
 */
export async function groupEncrypt(
  state: SenderKeyState,
  plaintext: Uint8Array,
): Promise<{ headerB64: string; ciphertextB64: string }> {
  const chain = base64ToBytes(state.chainKey);
  const msgKey = await deriveMessageKey(chain);
  const nextChain = await advanceChain(chain);
  const counter = state.n;
  const header: GroupHeader = {
    gv: 1,
    gid: state.groupId,
    ep: state.epoch,
    sender: state.senderUserId,
    n: counter,
  };
  const headerEnc = encodeHeader(header);
  const headerWithCounter = new Uint8Array(headerEnc.bytes.length + 4);
  headerWithCounter.set(headerEnc.bytes, 0);
  headerWithCounter.set(u32be(counter), headerEnc.bytes.length);
  const aead = await deriveAead(msgKey);
  const ct = await aesGcmEncrypt(aead.aesKey, aead.iv, plaintext, headerWithCounter);
  state.chainKey = bytesToBase64(nextChain);
  state.n = counter + 1;
  state.updatedAt = new Date().toISOString();
  return { headerB64: headerEnc.b64, ciphertextB64: bytesToBase64(ct) };
}

/**
 * Decrypt an inbound group message using the remote sender's chain.
 * Mutates the passed `state` in place (advances chain, may cache or
 * consume skipped keys). Caller persists the new state on success.
 *
 * Returns null if the message can't be decrypted (key not yet known,
 * or counter is too far behind to be in the skipped cache).
 */
export async function groupDecrypt(
  state: SenderKeyState,
  headerBytes: Uint8Array,
  header: GroupHeader,
  ciphertext: Uint8Array,
): Promise<Uint8Array | null> {
  if (header.n < state.n) {
    // Maybe in skipped cache.
    const msgKeyB64 = state.skipped[header.n];
    if (!msgKeyB64) return null;
    const msgKey = base64ToBytes(msgKeyB64);
    const headerWithCounter = new Uint8Array(headerBytes.length + 4);
    headerWithCounter.set(headerBytes, 0);
    headerWithCounter.set(u32be(header.n), headerBytes.length);
    const aead = await deriveAead(msgKey);
    try {
      const pt = await aesGcmDecrypt(aead.aesKey, aead.iv, ciphertext, headerWithCounter);
      delete state.skipped[header.n];
      state.updatedAt = new Date().toISOString();
      return pt;
    } catch {
      return null;
    }
  }

  // Fast-forward chain & cache skipped keys for [state.n .. header.n - 1].
  let chain = base64ToBytes(state.chainKey);
  let n = state.n;
  while (n < header.n) {
    const msgKey = await deriveMessageKey(chain);
    const skippedSet = state.skipped;
    skippedSet[n] = bytesToBase64(msgKey);
    // Cap the cache.
    const keys = Object.keys(skippedSet);
    if (keys.length > MAX_SKIPPED) {
      // Drop the oldest counters (smallest numeric values).
      const sorted = keys
        .map((k) => Number(k))
        .sort((a, b) => a - b);
      const drop = sorted.slice(0, sorted.length - MAX_SKIPPED);
      for (const d of drop) delete skippedSet[d];
    }
    chain = await advanceChain(chain);
    n += 1;
  }

  // Now n === header.n. Use this msg key, then advance.
  const msgKey = await deriveMessageKey(chain);
  const nextChain = await advanceChain(chain);

  const headerWithCounter = new Uint8Array(headerBytes.length + 4);
  headerWithCounter.set(headerBytes, 0);
  headerWithCounter.set(u32be(header.n), headerBytes.length);
  const aead = await deriveAead(msgKey);
  try {
    const pt = await aesGcmDecrypt(aead.aesKey, aead.iv, ciphertext, headerWithCounter);
    state.chainKey = bytesToBase64(nextChain);
    state.n = header.n + 1;
    state.updatedAt = new Date().toISOString();
    return pt;
  } catch {
    return null;
  }
}
