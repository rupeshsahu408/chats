import { db } from "../db";
import { bytesToBase64, base64ToBytes } from "../crypto";
import {
  generateX25519KeyPair,
  type X25519KeyPair,
} from "./x25519";
import { x3dhInitiate, x3dhRespond } from "./x3dh";
import {
  deserializeRatchet,
  initRatchetAlice,
  initRatchetBob,
  ratchetDecrypt,
  ratchetEncrypt,
  serializeRatchet,
  type MessageHeader,
  type RatchetState,
} from "./ratchet";
import { trpcClientProxy } from "../trpcClientProxy";

/**
 * High-level session manager bridging X3DH bootstrap, ratchet state,
 * and the wire format used by the `messages` router.
 *
 * Wire header (JSON, then UTF-8 bytes, then base64 for transport):
 *
 *   {
 *     v:    1,
 *     init: {                    // only on the first message of a session
 *       ek:    base64,           // sender's ephemeral X25519 pub
 *       ikX:   base64,           // sender's X25519 identity pub
 *       spkId: number,           // recipient's signed prekey id used
 *       opkId: number | null,    // recipient's one-time prekey id used
 *     } | undefined,
 *     dh:   base64,              // sender's current ratchet pub
 *     n:    number,
 *     pn:   number,
 *   }
 */

export interface UnlockedIdentity {
  /** Ed25519 identity (long-term, used for fingerprint + signing). */
  ed25519: { privateKey: Uint8Array; publicKey: Uint8Array };
  /** X25519 identity (long-term, used for X3DH ECDH). */
  x25519: X25519KeyPair;
  userId: string;
}

interface WireHeader {
  v: 1;
  init?: {
    ek: string;
    ikX: string;
    spkId: number;
    opkId: number | null;
  };
  dh: string;
  n: number;
  pn: number;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function encodeHeader(header: WireHeader): {
  bytes: Uint8Array;
  b64: string;
} {
  const json = JSON.stringify(header);
  const bytes = enc.encode(json);
  return { bytes, b64: bytesToBase64(bytes) };
}

function decodeHeader(b64: string): { header: WireHeader; bytes: Uint8Array } {
  const bytes = base64ToBytes(b64);
  const header = JSON.parse(dec.decode(bytes)) as WireHeader;
  return { header, bytes };
}

/* ─────────── Session persistence ─────────── */

async function loadState(peerId: string): Promise<RatchetState | null> {
  const row = await db.chatSessions.get(peerId);
  return row ? deserializeRatchet(row.state) : null;
}

async function saveState(peerId: string, state: RatchetState): Promise<void> {
  await db.chatSessions.put({
    peerId,
    state: serializeRatchet(state),
    updatedAt: new Date().toISOString(),
  });
}

/* ─────────── Encrypt path ─────────── */

export async function encryptToPeer(
  identity: UnlockedIdentity,
  peerId: string,
  plaintext: string,
): Promise<{ headerB64: string; ciphertextB64: string }> {
  let state = await loadState(peerId);
  let initBlock: WireHeader["init"] | undefined;

  if (!state) {
    // First message — run X3DH initiator.
    const bundle = await trpcClientProxy().prekeys.claimBundleFor.mutate({
      peerId,
    });
    if (!bundle.identityX25519PublicKey) {
      throw new Error(
        "Peer hasn't enabled chat yet (no X25519 identity key on the server).",
      );
    }
    const x3dh = await x3dhInitiate({
      myIdentityX25519: identity.x25519,
      peerIdentityX25519Pub: base64ToBytes(bundle.identityX25519PublicKey),
      peerIdentityEd25519Pub: base64ToBytes(bundle.identityPublicKey),
      peerSignedPreKey: {
        keyId: bundle.signedPreKey.keyId,
        publicKey: base64ToBytes(bundle.signedPreKey.publicKey),
        signature: base64ToBytes(bundle.signedPreKey.signature),
      },
      peerOneTimePreKey: bundle.oneTimePreKey
        ? {
            keyId: bundle.oneTimePreKey.keyId,
            publicKey: base64ToBytes(bundle.oneTimePreKey.publicKey),
          }
        : null,
    });
    state = await initRatchetAlice({
      rootKey: x3dh.sharedSecret,
      peerSignedPreKeyPub: base64ToBytes(bundle.signedPreKey.publicKey),
      associatedData: x3dh.associatedData,
    });
    initBlock = {
      ek: bytesToBase64(x3dh.ephemeral.publicKey),
      ikX: bytesToBase64(identity.x25519.publicKey),
      spkId: x3dh.usedSignedPreKeyId,
      opkId: x3dh.usedOneTimePreKeyId,
    };
  }

  const wireHeader: WireHeader = {
    v: 1,
    init: initBlock,
    dh: bytesToBase64(state.dhs.publicKey),
    n: state.ns,
    pn: state.pn,
  };
  const encodedHeader = encodeHeader(wireHeader);

  const ratchetHeaderForState: MessageHeader = {
    ratchetPub: state.dhs.publicKey,
    n: state.ns,
    pn: state.pn,
  };
  // Mutate ns inside ratchetEncrypt; pass the header bytes as extra AD.
  const enc1 = await ratchetEncrypt(state, enc.encode(plaintext), encodedHeader.bytes);
  // ratchetEncrypt already returned an updated header — but we want the wire
  // header we already computed (which matches the pre-bump n/pn). Use it.
  void ratchetHeaderForState;
  void enc1.header;

  await saveState(peerId, state);
  return {
    headerB64: encodedHeader.b64,
    ciphertextB64: bytesToBase64(enc1.ciphertext),
  };
}

/* ─────────── Decrypt path ─────────── */

export interface OneTimePreKeyLookup {
  /** Returns the X25519 keypair for the given OPK id, or null if unknown / consumed. */
  (keyId: number): Promise<X25519KeyPair | null>;
}

export interface SignedPreKeyLookup {
  /** Returns the X25519 keypair for the given SPK id, or null if unknown. */
  (keyId: number): Promise<X25519KeyPair | null>;
}

export async function decryptFromPeer(
  identity: UnlockedIdentity,
  peerId: string,
  headerB64: string,
  ciphertextB64: string,
  lookups: {
    spk: SignedPreKeyLookup;
    opk: OneTimePreKeyLookup;
    consumeOpk: (keyId: number) => Promise<void>;
  },
): Promise<string> {
  const { header: wire, bytes: headerBytes } = decodeHeader(headerB64);
  const ciphertext = base64ToBytes(ciphertextB64);

  const headerForRatchet: MessageHeader = {
    ratchetPub: base64ToBytes(wire.dh),
    n: wire.n,
    pn: wire.pn,
  };

  /**
   * Run the X3DH responder for the given init block and return a fresh
   * Bob-side ratchet state. Used both for first-ever sessions AND for
   * the re-bootstrap path below (when the peer signs in on a new device
   * and starts a brand-new X3DH handshake while we still hold a stale
   * ratchet state for them).
   */
  const bootstrapFromInit = async (
    init: NonNullable<WireHeader["init"]>,
  ): Promise<{ state: RatchetState; opkIdToConsume: number | null }> => {
    const spk = await lookups.spk(init.spkId);
    if (!spk) {
      throw new Error(
        `Initial message references signed prekey id ${init.spkId} which we no longer have.`,
      );
    }
    const opk = init.opkId !== null ? await lookups.opk(init.opkId) : null;
    if (init.opkId !== null && !opk) {
      throw new Error(
        `Initial message references one-time prekey id ${init.opkId} which we no longer have.`,
      );
    }
    const x3dh = await x3dhRespond({
      myIdentityX25519: identity.x25519,
      mySignedPreKey: spk,
      myOneTimePreKey: opk,
      peerIdentityX25519Pub: base64ToBytes(init.ikX),
      peerEphemeralPub: base64ToBytes(init.ek),
    });
    const fresh = initRatchetBob({
      rootKey: x3dh.sharedSecret,
      mySignedPreKey: spk,
      associatedData: x3dh.associatedData,
    });
    return { state: fresh, opkIdToConsume: init.opkId };
  };

  let state = await loadState(peerId);
  let pendingOpkConsume: number | null = null;

  if (!state) {
    if (!wire.init) {
      throw new Error(
        "No session for this peer and message lacks an X3DH init block.",
      );
    }
    // First-ever message in this session — run X3DH responder.
    const boot = await bootstrapFromInit(wire.init);
    state = boot.state;
    pendingOpkConsume = boot.opkIdToConsume;
  }

  let plaintext: Uint8Array;
  try {
    plaintext = await ratchetDecrypt(
      state,
      headerForRatchet,
      ciphertext,
      headerBytes,
    );
  } catch (err) {
    // Recovery path: the peer may have signed in on a new device and
    // bootstrapped a brand-new X3DH session while our local store still
    // holds the previous ratchet state. In that case the wire header
    // carries an `init` block describing the fresh handshake — replace
    // our stale state with one derived from that init and retry decrypt.
    // Without this branch the two devices stay deadlocked: the new device
    // can never decrypt anything we send (we have no init to give it),
    // and we can never decrypt anything it sends (we ignore its init).
    if (!wire.init) throw err;
    const boot = await bootstrapFromInit(wire.init);
    plaintext = await ratchetDecrypt(
      boot.state,
      headerForRatchet,
      ciphertext,
      headerBytes,
    );
    state = boot.state;
    pendingOpkConsume = boot.opkIdToConsume;
  }

  await saveState(peerId, state);
  // Forward secrecy: drop the OPK private key only after a successful
  // decrypt, so a malformed or forged init block can never burn a still-
  // valid one-time prekey.
  if (pendingOpkConsume !== null) {
    await lookups.consumeOpk(pendingOpkConsume);
  }
  return dec.decode(plaintext);
}

/* ─────────── Helpers ─────────── */

export async function deleteSession(peerId: string): Promise<void> {
  await db.chatSessions.delete(peerId);
}

/**
 * Generate one extra one-time prekey to top up after the server consumed
 * one. Caller is responsible for storing the private half + uploading.
 */
export function freshOneTimePreKey(): X25519KeyPair {
  return generateX25519KeyPair();
}
