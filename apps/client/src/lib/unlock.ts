import {
  base64ToBytes,
  bytesToBase64,
  decryptWithPin,
  encryptWithPin,
  deriveIdentityFromPhrase,
  deriveX25519FromPhrase,
} from "./crypto";
import { ed25519 } from "@noble/curves/ed25519.js";
import { loadIdentity, saveIdentity } from "./db";
import {
  generateX25519KeyPair,
  x25519PublicKeyFromPrivate,
} from "./signal/x25519";
import { trpcClientProxy } from "./trpcClientProxy";
import { buildPrekeyBundle } from "./prekeys";
import type { UnlockedIdentity } from "./signal/session";

/**
 * True when the stored identity record was derived from a BIP-39 recovery
 * phrase (random ID accounts) rather than encrypted with a PIN.
 */
export function isPhraseDerived(rec: { iv: string }): boolean {
  return rec.iv === "phrase-derived";
}

/**
 * Unlock for random-ID accounts: derive keys deterministically from the
 * recovery phrase, no decryption step needed.
 */
export async function unlockIdentityFromPhrase(
  phrase: string,
): Promise<UnlockedIdentity> {
  const rec = await loadIdentity();
  if (!rec) {
    throw new Error("No on-device identity found. Please sign in first.");
  }
  if (!isPhraseDerived(rec)) {
    throw new Error(
      "This account uses a PIN, not a recovery phrase. Use the PIN unlock instead.",
    );
  }

  const ed = deriveIdentityFromPhrase(phrase);

  // Verify the derived public key matches what we stored.
  const storedPub = base64ToBytes(rec.publicKey);
  if (!storedPub.every((v, i) => v === ed.publicKey[i])) {
    throw new Error(
      "Recovery phrase doesn't match this account. Check your words.",
    );
  }

  const { privateKey: x25519Priv } = deriveX25519FromPhrase(phrase);
  const x25519Pub = x25519PublicKeyFromPrivate(x25519Priv);

  if (rec.x25519PublicKey) {
    const storedX25519 = base64ToBytes(rec.x25519PublicKey);
    if (!storedX25519.every((v, i) => v === x25519Pub[i])) {
      throw new Error("X25519 key mismatch — recovery phrase may be wrong.");
    }
  }

  return {
    userId: rec.userId,
    ed25519: ed,
    x25519: { privateKey: x25519Priv, publicKey: x25519Pub },
  };
}

/**
 * Unlock the on-device identity using the user's PIN.
 *
 * Workflow:
 *   1. Decrypt the Ed25519 private key.
 *   2. If we don't yet have an X25519 identity (Phase 1/2 → 3 migration):
 *        a. Generate a fresh X25519 keypair.
 *        b. Encrypt the private half with the same PIN.
 *        c. Persist locally.
 *        d. Upload the public half to the server.
 *        e. Re-upload prekeys as X25519 (`replaceOneTime: true`).
 *   3. Otherwise, just decrypt the existing X25519 private key.
 *   4. Return the in-memory `UnlockedIdentity`.
 */
export async function unlockIdentity(pin: string): Promise<UnlockedIdentity> {
  const rec = await loadIdentity();
  if (!rec) {
    throw new Error("No on-device identity found. Please sign up first.");
  }

  if (isPhraseDerived(rec)) {
    throw new Error(
      "This is a Random ID account. Use your recovery phrase instead.",
    );
  }

  // Decrypt Ed25519 identity.
  const edPriv = await decryptWithPin(pin, {
    ciphertext: base64ToBytes(rec.encPrivateKey),
    iv: base64ToBytes(rec.iv),
    salt: base64ToBytes(rec.salt),
  });
  const edPub = ed25519.getPublicKey(edPriv);

  // X25519 — load or migrate.
  let x25519Priv: Uint8Array;
  let x25519Pub: Uint8Array;

  if (rec.encX25519PrivateKey && rec.iv2 && rec.salt2 && rec.x25519PublicKey) {
    x25519Priv = await decryptWithPin(pin, {
      ciphertext: base64ToBytes(rec.encX25519PrivateKey),
      iv: base64ToBytes(rec.iv2),
      salt: base64ToBytes(rec.salt2),
    });
    x25519Pub = base64ToBytes(rec.x25519PublicKey);
    const derived = x25519PublicKeyFromPrivate(x25519Priv);
    if (
      derived.length !== x25519Pub.length ||
      !derived.every((v, i) => v === x25519Pub[i])
    ) {
      throw new Error(
        "X25519 key mismatch — your local data may be corrupted.",
      );
    }
  } else {
    // Migration: generate a fresh X25519 identity, save, upload.
    const kp = generateX25519KeyPair();
    x25519Priv = kp.privateKey;
    x25519Pub = kp.publicKey;
    const blob = await encryptWithPin(pin, x25519Priv);
    await saveIdentity({
      ...rec,
      encX25519PrivateKey: bytesToBase64(blob.ciphertext),
      iv2: bytesToBase64(blob.iv),
      salt2: bytesToBase64(blob.salt),
      x25519PublicKey: bytesToBase64(x25519Pub),
    });
    try {
      await trpcClientProxy().me.setX25519Identity.mutate({
        publicKey: bytesToBase64(x25519Pub),
      });
    } catch (err) {
      throw new Error(
        `Couldn't register your chat key with the server: ${
          err instanceof Error ? err.message : String(err)
        }. Try again when you're online.`,
      );
    }
    try {
      const bundle = await buildPrekeyBundle({
        identityPrivateKey: edPriv,
        numOneTime: 20,
        freshStart: true,
      });
      await trpcClientProxy().prekeys.upload.mutate(bundle);
    } catch (err) {
      console.warn("Prekey re-upload failed during X25519 migration", err);
    }
  }

  return {
    userId: rec.userId,
    ed25519: { privateKey: edPriv, publicKey: edPub },
    x25519: { privateKey: x25519Priv, publicKey: x25519Pub },
  };
}
