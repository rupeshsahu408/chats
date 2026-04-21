import { signWithIdentity, bytesToBase64 } from "./crypto";
import { generateX25519KeyPair } from "./signal/x25519";
import {
  saveSignedPrekey,
  saveOneTimePrekeys,
  getMaxOneTimePrekeyId,
  clearAllOneTimePrekeys,
} from "./db";

/**
 * Generate a fresh signed prekey + N one-time prekeys, store the private
 * halves locally, and return the public bundle ready for upload.
 *
 * Phase 3 onwards these are X25519 keypairs (used for X3DH ECDH).
 * The signed prekey is signed by the user's Ed25519 identity key — same
 * wire format as Phase 2 (32 B pub, 64 B sig).
 */
export async function buildPrekeyBundle(opts: {
  /** Ed25519 identity private key (used to sign the signed prekey). */
  identityPrivateKey: Uint8Array;
  signedPreKeyId?: number;
  numOneTime?: number;
  /** When true, wipes any existing local OTPKs first (curve migration). */
  freshStart?: boolean;
}) {
  const numOneTime = opts.numOneTime ?? 20;

  if (opts.freshStart) {
    await clearAllOneTimePrekeys();
  }

  // Signed prekey (X25519).
  const spkId =
    opts.signedPreKeyId ?? Math.floor(Date.now() / 1000) % 0xffffff;
  const spk = generateX25519KeyPair();
  const spkSig = signWithIdentity(opts.identityPrivateKey, spk.publicKey);
  await saveSignedPrekey({
    keyId: spkId,
    privateKey: bytesToBase64(spk.privateKey),
    publicKey: bytesToBase64(spk.publicKey),
  });

  // One-time prekeys (X25519).
  const startId = opts.freshStart ? 1 : (await getMaxOneTimePrekeyId()) + 1;
  const otpkLocal: Array<{
    keyId: number;
    privateKey: string;
    publicKey: string;
  }> = [];
  const otpkPublic: Array<{ keyId: number; publicKey: string }> = [];
  for (let i = 0; i < numOneTime; i++) {
    const k = generateX25519KeyPair();
    const id = startId + i;
    const pubB64 = bytesToBase64(k.publicKey);
    otpkLocal.push({
      keyId: id,
      privateKey: bytesToBase64(k.privateKey),
      publicKey: pubB64,
    });
    otpkPublic.push({ keyId: id, publicKey: pubB64 });
  }
  await saveOneTimePrekeys(otpkLocal);

  return {
    signedPreKey: {
      keyId: spkId,
      publicKey: bytesToBase64(spk.publicKey),
      signature: bytesToBase64(spkSig),
    },
    oneTimePreKeys: otpkPublic,
    replaceOneTime: !!opts.freshStart,
  };
}
