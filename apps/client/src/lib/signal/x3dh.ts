import { ed25519 } from "@noble/curves/ed25519.js";
import {
  generateX25519KeyPair,
  x25519DH,
  type X25519KeyPair,
} from "./x25519";
import { hkdf, concatBytes } from "./kdf";

/**
 * X3DH (Extended Triple Diffie-Hellman) shared-secret derivation.
 *
 *   IK_A  — Alice's X25519 identity key
 *   IK_B  — Bob's   X25519 identity key
 *   EK_A  — Alice's ephemeral X25519 key (one per session init)
 *   SPK_B — Bob's signed prekey (X25519, signed by his Ed25519 identity)
 *   OPK_B — Bob's one-time prekey (optional)
 *
 *   DH1 = DH(IK_A, SPK_B)
 *   DH2 = DH(EK_A, IK_B)
 *   DH3 = DH(EK_A, SPK_B)
 *   DH4 = DH(EK_A, OPK_B)         // if OPK present
 *   SK  = HKDF( 0xFF*32 || DH1 || DH2 || DH3 [|| DH4] )
 *
 * The 0xFF*32 prefix follows the spec's recommendation to distinguish
 * X25519 from X448 inputs.
 */

const F_PREFIX = (() => {
  const a = new Uint8Array(32);
  a.fill(0xff);
  return a;
})();

export interface X3DHInitiatorInput {
  myIdentityX25519: X25519KeyPair;
  peerIdentityX25519Pub: Uint8Array;
  peerIdentityEd25519Pub: Uint8Array;
  peerSignedPreKey: {
    keyId: number;
    publicKey: Uint8Array;
    signature: Uint8Array;
  };
  peerOneTimePreKey: { keyId: number; publicKey: Uint8Array } | null;
}

export interface X3DHInitiatorOutput {
  sharedSecret: Uint8Array;
  ephemeral: X25519KeyPair;
  associatedData: Uint8Array;
  usedSignedPreKeyId: number;
  usedOneTimePreKeyId: number | null;
}

/** Alice (initiator) side. */
export async function x3dhInitiate(
  input: X3DHInitiatorInput,
): Promise<X3DHInitiatorOutput> {
  // Verify the signed prekey signature with Bob's Ed25519 identity.
  // If this fails the peer's server-stored prekey was signed by a key
  // that no longer matches their identity public key — typically an
  // older client that uploaded prekeys signed with a different key.
  // Sending is impossible until *they* refresh their prekeys; the
  // client now does this automatically on every unlock (see
  // `verifyAndRefreshOwnPrekeys` in lib/unlock.ts), so most affected
  // peers heal themselves the next time they open the app. We surface
  // an actionable, human-readable message so the sender knows what's
  // going on instead of staring at a stack-trace-y crypto error.
  const sigOk = ed25519.verify(
    input.peerSignedPreKey.signature,
    input.peerSignedPreKey.publicKey,
    input.peerIdentityEd25519Pub,
  );
  if (!sigOk) {
    throw new Error(
      "This person's encryption keys are out of sync on the server. Ask them to open VeilChat once — it auto-repairs on unlock — then try sending again.",
    );
  }

  const ek = generateX25519KeyPair();

  const dh1 = x25519DH(
    input.myIdentityX25519.privateKey,
    input.peerSignedPreKey.publicKey,
  );
  const dh2 = x25519DH(ek.privateKey, input.peerIdentityX25519Pub);
  const dh3 = x25519DH(ek.privateKey, input.peerSignedPreKey.publicKey);
  const dh4 = input.peerOneTimePreKey
    ? x25519DH(ek.privateKey, input.peerOneTimePreKey.publicKey)
    : null;

  const ikm = dh4
    ? concatBytes(F_PREFIX, dh1, dh2, dh3, dh4)
    : concatBytes(F_PREFIX, dh1, dh2, dh3);

  const sharedSecret = await hkdf(
    ikm,
    new Uint8Array(32),
    "veil/x3dh/v1",
    32,
  );

  // Associated data ties the session to both identity keys.
  const associatedData = concatBytes(
    input.myIdentityX25519.publicKey,
    input.peerIdentityX25519Pub,
  );

  return {
    sharedSecret,
    ephemeral: ek,
    associatedData,
    usedSignedPreKeyId: input.peerSignedPreKey.keyId,
    usedOneTimePreKeyId: input.peerOneTimePreKey?.keyId ?? null,
  };
}

export interface X3DHResponderInput {
  myIdentityX25519: X25519KeyPair;
  mySignedPreKey: X25519KeyPair;
  myOneTimePreKey: X25519KeyPair | null;
  peerIdentityX25519Pub: Uint8Array;
  peerEphemeralPub: Uint8Array;
}

export interface X3DHResponderOutput {
  sharedSecret: Uint8Array;
  associatedData: Uint8Array;
}

/** Bob (responder) side. Mirrors the four DH operations in reverse. */
export async function x3dhRespond(
  input: X3DHResponderInput,
): Promise<X3DHResponderOutput> {
  const dh1 = x25519DH(
    input.mySignedPreKey.privateKey,
    input.peerIdentityX25519Pub,
  );
  const dh2 = x25519DH(
    input.myIdentityX25519.privateKey,
    input.peerEphemeralPub,
  );
  const dh3 = x25519DH(
    input.mySignedPreKey.privateKey,
    input.peerEphemeralPub,
  );
  const dh4 = input.myOneTimePreKey
    ? x25519DH(input.myOneTimePreKey.privateKey, input.peerEphemeralPub)
    : null;

  const ikm = dh4
    ? concatBytes(F_PREFIX, dh1, dh2, dh3, dh4)
    : concatBytes(F_PREFIX, dh1, dh2, dh3);

  const sharedSecret = await hkdf(
    ikm,
    new Uint8Array(32),
    "veil/x3dh/v1",
    32,
  );

  // AD swapped — Alice's IK first, then Bob's.
  const associatedData = concatBytes(
    input.peerIdentityX25519Pub,
    input.myIdentityX25519.publicKey,
  );

  return { sharedSecret, associatedData };
}
