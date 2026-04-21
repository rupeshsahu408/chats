import {
  generateX25519KeyPair,
  x25519DH,
  type X25519KeyPair,
} from "./x25519";
import { hkdf, hmacSha256, concatBytes } from "./kdf";
import { aesGcmDecrypt, aesGcmEncrypt, deriveAead } from "./aead";

/**
 * Double Ratchet (Signal). Per the spec:
 *
 *   - DH ratchet: each party rolls a fresh DH keypair on first send
 *     after receiving from the peer; combined with the peer's latest
 *     pubkey it advances the root key.
 *   - Symmetric ratchet: each chain key advances per-message,
 *     producing per-message keys without further ECC work.
 *
 * We cap skipped message keys at 100 per direction so a malicious peer
 * can't blow up our memory by claiming arbitrarily large message numbers.
 */

const MAX_SKIP = 100;

export interface RatchetState {
  rootKey: Uint8Array;
  /** Our current sending DH keypair. */
  dhs: X25519KeyPair;
  /** Peer's current sending DH public key. */
  dhr: Uint8Array | null;
  sendingChainKey: Uint8Array | null;
  receivingChainKey: Uint8Array | null;
  /** Counter of messages sent in the current sending chain. */
  ns: number;
  /** Counter of messages received in the current receiving chain. */
  nr: number;
  /** Length of the previous sending chain (for skipped-key handling). */
  pn: number;
  /** Skipped message keys: outer key = peer DH pub b64, inner key = msg number. */
  skipped: Map<string, Map<number, Uint8Array>>;
  totalSkipped: number;
  associatedData: Uint8Array;
}

export interface MessageHeader {
  /** Sender's current ratchet pub. */
  ratchetPub: Uint8Array;
  /** Length of sender's previous sending chain. */
  pn: number;
  /** Message number within current sending chain. */
  n: number;
}

/* ─────────── KDFs ─────────── */

async function kdfRk(
  rootKey: Uint8Array,
  dhOut: Uint8Array,
): Promise<{ rk: Uint8Array; ck: Uint8Array }> {
  const out = await hkdf(dhOut, rootKey, "veil/ratchet/rk/v1", 64);
  return { rk: out.slice(0, 32), ck: out.slice(32, 64) };
}

async function kdfCk(
  chainKey: Uint8Array,
): Promise<{ ck: Uint8Array; mk: Uint8Array }> {
  // HMAC with constants 0x01 (next CK) and 0x02 (message key) per Signal spec.
  const ck = await hmacSha256(chainKey, new Uint8Array([0x02]));
  const mk = await hmacSha256(chainKey, new Uint8Array([0x01]));
  return { ck, mk };
}

/* ─────────── Initialisation ─────────── */

export async function initRatchetAlice(opts: {
  rootKey: Uint8Array;
  peerSignedPreKeyPub: Uint8Array;
  associatedData: Uint8Array;
}): Promise<RatchetState> {
  const dhs = generateX25519KeyPair();
  const dhOut = x25519DH(dhs.privateKey, opts.peerSignedPreKeyPub);
  const { rk, ck } = await kdfRk(opts.rootKey, dhOut);
  return {
    rootKey: rk,
    dhs,
    dhr: opts.peerSignedPreKeyPub,
    sendingChainKey: ck,
    receivingChainKey: null,
    ns: 0,
    nr: 0,
    pn: 0,
    skipped: new Map(),
    totalSkipped: 0,
    associatedData: opts.associatedData,
  };
}

export function initRatchetBob(opts: {
  rootKey: Uint8Array;
  mySignedPreKey: X25519KeyPair;
  associatedData: Uint8Array;
}): RatchetState {
  return {
    rootKey: opts.rootKey,
    dhs: opts.mySignedPreKey,
    dhr: null,
    sendingChainKey: null,
    receivingChainKey: null,
    ns: 0,
    nr: 0,
    pn: 0,
    skipped: new Map(),
    totalSkipped: 0,
    associatedData: opts.associatedData,
  };
}

/* ─────────── Encrypt ─────────── */

export interface EncryptedRatchetMessage {
  header: MessageHeader;
  ciphertext: Uint8Array;
}

export async function ratchetEncrypt(
  state: RatchetState,
  plaintext: Uint8Array,
  /** Extra bytes mixed into the AEAD AD (e.g. the encoded header). */
  extraAd: Uint8Array,
): Promise<EncryptedRatchetMessage> {
  if (!state.sendingChainKey) {
    throw new Error(
      "Cannot encrypt before performing a sending DH ratchet step.",
    );
  }
  const { ck, mk } = await kdfCk(state.sendingChainKey);
  state.sendingChainKey = ck;
  const header: MessageHeader = {
    ratchetPub: state.dhs.publicKey,
    pn: state.pn,
    n: state.ns,
  };
  state.ns += 1;
  const { aesKey, iv } = await deriveAead(mk);
  const ad = concatBytes(state.associatedData, extraAd);
  const ciphertext = await aesGcmEncrypt(aesKey, iv, plaintext, ad);
  return { header, ciphertext };
}

/* ─────────── Decrypt ─────────── */

function pubKeyId(pub: Uint8Array): string {
  // base64-ish stable id; we just need a string key for the Map.
  let s = "";
  for (let i = 0; i < pub.length; i++)
    s += pub[i]!.toString(16).padStart(2, "0");
  return s;
}

async function trySkipped(
  state: RatchetState,
  header: MessageHeader,
  ciphertext: Uint8Array,
  extraAd: Uint8Array,
): Promise<Uint8Array | null> {
  const id = pubKeyId(header.ratchetPub);
  const inner = state.skipped.get(id);
  if (!inner) return null;
  const mk = inner.get(header.n);
  if (!mk) return null;
  inner.delete(header.n);
  state.totalSkipped -= 1;
  if (inner.size === 0) state.skipped.delete(id);
  const { aesKey, iv } = await deriveAead(mk);
  const ad = concatBytes(state.associatedData, extraAd);
  return await aesGcmDecrypt(aesKey, iv, ciphertext, ad);
}

async function skipKeysUntil(
  state: RatchetState,
  until: number,
): Promise<void> {
  if (!state.receivingChainKey || state.dhr === null) return;
  if (state.nr + MAX_SKIP < until) {
    throw new Error("Too many skipped messages.");
  }
  const id = pubKeyId(state.dhr);
  let bucket = state.skipped.get(id);
  if (!bucket) {
    bucket = new Map();
    state.skipped.set(id, bucket);
  }
  while (state.nr < until) {
    const { ck, mk } = await kdfCk(state.receivingChainKey);
    state.receivingChainKey = ck;
    bucket.set(state.nr, mk);
    state.totalSkipped += 1;
    state.nr += 1;
    if (state.totalSkipped > MAX_SKIP) {
      // Drop oldest skipped key.
      const firstKey = bucket.keys().next().value;
      if (firstKey !== undefined) {
        bucket.delete(firstKey);
        state.totalSkipped -= 1;
      }
    }
  }
}

async function dhRatchet(
  state: RatchetState,
  newPeerPub: Uint8Array,
): Promise<void> {
  state.pn = state.ns;
  state.ns = 0;
  state.nr = 0;
  state.dhr = newPeerPub;
  // Receiving step.
  const dhOut1 = x25519DH(state.dhs.privateKey, state.dhr);
  const r1 = await kdfRk(state.rootKey, dhOut1);
  state.rootKey = r1.rk;
  state.receivingChainKey = r1.ck;
  // New sending key + sending step.
  state.dhs = generateX25519KeyPair();
  const dhOut2 = x25519DH(state.dhs.privateKey, state.dhr);
  const r2 = await kdfRk(state.rootKey, dhOut2);
  state.rootKey = r2.rk;
  state.sendingChainKey = r2.ck;
}

export async function ratchetDecrypt(
  state: RatchetState,
  header: MessageHeader,
  ciphertext: Uint8Array,
  extraAd: Uint8Array,
): Promise<Uint8Array> {
  // Maybe the message corresponds to a previously-skipped key.
  const fromSkipped = await trySkipped(state, header, ciphertext, extraAd);
  if (fromSkipped) return fromSkipped;

  // If the peer rotated their DH key, do a DH ratchet step.
  const peerChanged =
    !state.dhr ||
    pubKeyId(header.ratchetPub) !== pubKeyId(state.dhr);
  if (peerChanged) {
    // Skip remaining keys in the current receiving chain (if any).
    if (state.receivingChainKey && state.dhr) {
      await skipKeysUntil(state, header.pn);
    }
    await dhRatchet(state, header.ratchetPub);
  }

  // Skip up to header.n in the current chain.
  await skipKeysUntil(state, header.n);
  if (!state.receivingChainKey) {
    throw new Error("Receiving chain not initialised.");
  }
  const { ck, mk } = await kdfCk(state.receivingChainKey);
  state.receivingChainKey = ck;
  state.nr += 1;

  const { aesKey, iv } = await deriveAead(mk);
  const ad = concatBytes(state.associatedData, extraAd);
  return await aesGcmDecrypt(aesKey, iv, ciphertext, ad);
}

/* ─────────── Serialization (Dexie-friendly JSON) ─────────── */

interface SerializedState {
  rootKey: string;
  dhsPriv: string;
  dhsPub: string;
  dhr: string | null;
  sendingChainKey: string | null;
  receivingChainKey: string | null;
  ns: number;
  nr: number;
  pn: number;
  skipped: Array<[string, Array<[number, string]>]>;
  totalSkipped: number;
  associatedData: string;
}

const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const fromB64 = (s: string) => {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

export function serializeRatchet(state: RatchetState): string {
  const skipped: SerializedState["skipped"] = [];
  for (const [k, m] of state.skipped) {
    const entries: Array<[number, string]> = [];
    for (const [n, mk] of m) entries.push([n, b64(mk)]);
    skipped.push([k, entries]);
  }
  const s: SerializedState = {
    rootKey: b64(state.rootKey),
    dhsPriv: b64(state.dhs.privateKey),
    dhsPub: b64(state.dhs.publicKey),
    dhr: state.dhr ? b64(state.dhr) : null,
    sendingChainKey: state.sendingChainKey ? b64(state.sendingChainKey) : null,
    receivingChainKey: state.receivingChainKey
      ? b64(state.receivingChainKey)
      : null,
    ns: state.ns,
    nr: state.nr,
    pn: state.pn,
    skipped,
    totalSkipped: state.totalSkipped,
    associatedData: b64(state.associatedData),
  };
  return JSON.stringify(s);
}

export function deserializeRatchet(json: string): RatchetState {
  const s = JSON.parse(json) as SerializedState;
  const skipped = new Map<string, Map<number, Uint8Array>>();
  for (const [k, entries] of s.skipped) {
    const inner = new Map<number, Uint8Array>();
    for (const [n, mk] of entries) inner.set(n, fromB64(mk));
    skipped.set(k, inner);
  }
  return {
    rootKey: fromB64(s.rootKey),
    dhs: { privateKey: fromB64(s.dhsPriv), publicKey: fromB64(s.dhsPub) },
    dhr: s.dhr ? fromB64(s.dhr) : null,
    sendingChainKey: s.sendingChainKey ? fromB64(s.sendingChainKey) : null,
    receivingChainKey: s.receivingChainKey ? fromB64(s.receivingChainKey) : null,
    ns: s.ns,
    nr: s.nr,
    pn: s.pn,
    skipped,
    totalSkipped: s.totalSkipped,
    associatedData: fromB64(s.associatedData),
  };
}
