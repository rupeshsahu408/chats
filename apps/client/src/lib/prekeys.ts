import {
  generateIdentityKeyPair,
  signWithIdentity,
  bytesToBase64,
} from "./crypto";
import {
  saveSignedPrekey,
  saveOneTimePrekeys,
  getMaxOneTimePrekeyId,
} from "./db";

/**
 * Generate a fresh signed prekey + N one-time prekeys, store the private
 * halves locally, and return the public bundle ready for upload.
 *
 * Note: in Phase 2 these are Ed25519 keypairs (same curve as identity).
 * Phase 3 will swap to X25519 for X3DH; the wire format is unchanged.
 */
export async function buildPrekeyBundle(opts: {
  identityPrivateKey: Uint8Array;
  signedPreKeyId?: number;
  numOneTime?: number;
}) {
  const numOneTime = opts.numOneTime ?? 20;

  // Signed prekey.
  const spkId =
    opts.signedPreKeyId ??
    Math.floor(Date.now() / 1000) % 0xffffff;
  const spk = generateIdentityKeyPair();
  const spkSig = signWithIdentity(opts.identityPrivateKey, spk.publicKey);
  await saveSignedPrekey({
    keyId: spkId,
    privateKey: bytesToBase64(spk.privateKey),
    publicKey: bytesToBase64(spk.publicKey),
  });

  // One-time prekeys.
  const startId = (await getMaxOneTimePrekeyId()) + 1;
  const otpkLocal: Array<{
    keyId: number;
    privateKey: string;
    publicKey: string;
  }> = [];
  const otpkPublic: Array<{ keyId: number; publicKey: string }> = [];
  for (let i = 0; i < numOneTime; i++) {
    const k = generateIdentityKeyPair();
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
  };
}
