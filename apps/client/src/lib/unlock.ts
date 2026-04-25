import {
  base64ToBytes,
  bytesToBase64,
  decryptWithPin,
  encryptWithPin,
  deriveIdentityFromPhrase,
  deriveX25519FromPhrase,
  generateRecoveryPhrase,
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
 * Recover a Random-ID account on a brand-new device.
 *
 * No local IndexedDB record exists yet (the user has never run the app
 * on this device), so we:
 *
 *   1. Derive Ed25519 + X25519 keypairs from the 12-word phrase.
 *   2. Verify the derived X25519 public key matches what the server
 *      already has registered for this user (`me.setX25519Identity`
 *      throws CONFLICT if they differ — the phrase is wrong).
 *   3. Persist the derived identity locally so the user only enters
 *      the phrase once per browser.
 *   4. Re-upload prekeys (the previous device's one-time prekeys are
 *      either consumed or unknown to us; uploading a fresh batch
 *      ensures incoming peers can still complete X3DH with us).
 *
 * If step 2 fails with CONFLICT we surface a friendly "phrase doesn't
 * match" error and DO NOT save anything locally — leaving the user
 * free to retry with the correct phrase.
 */
export async function recoverIdentityFromPhraseOnNewDevice(
  phrase: string,
  userId: string,
): Promise<UnlockedIdentity> {
  const ed = deriveIdentityFromPhrase(phrase);
  const { privateKey: x25519Priv } = deriveX25519FromPhrase(phrase);
  const x25519Pub = x25519PublicKeyFromPrivate(x25519Priv);

  // Server-side correctness check: if the user already registered an
  // X25519 identity (the common case post-signup), this either no-ops
  // (key matches → phrase correct) or throws CONFLICT (phrase wrong).
  try {
    await trpcClientProxy().me.setX25519Identity.mutate({
      publicKey: bytesToBase64(x25519Pub),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/conflict|differs|already set/i.test(msg)) {
      throw new Error(
        "Recovery phrase doesn't match this account. Check your words.",
      );
    }
    throw new Error(
      `Couldn't verify your recovery phrase with the server: ${msg}`,
    );
  }

  await saveIdentity({
    id: "self",
    userId,
    encPrivateKey: bytesToBase64(ed.privateKey),
    iv: "phrase-derived",
    salt: "phrase-derived",
    publicKey: bytesToBase64(ed.publicKey),
    encX25519PrivateKey: bytesToBase64(x25519Priv),
    iv2: "phrase-derived",
    salt2: "phrase-derived",
    x25519PublicKey: bytesToBase64(x25519Pub),
    recoveryPhrase: phrase,
    createdAt: new Date().toISOString(),
  });

  // Best-effort prekey re-upload. Failure here is non-fatal — the user
  // can still send messages; only inbound first-contacts from new
  // peers would be affected, and SessionSync re-runs on next unlock.
  try {
    const bundle = await buildPrekeyBundle({
      identityPrivateKey: ed.privateKey,
      numOneTime: 20,
      freshStart: true,
    });
    await trpcClientProxy().prekeys.upload.mutate(bundle);
  } catch (err) {
    console.warn("Prekey re-upload failed during new-device recovery", err);
  }

  return {
    userId,
    ed25519: ed,
    x25519: { privateKey: x25519Priv, publicKey: x25519Pub },
  };
}

/**
 * Daily-password recovery on a brand-new device.
 *
 * Used when a Random-ID account holder has lost (or never recorded)
 * their 12-word recovery phrase but still knows the daily verification
 * password they set at sign-up. Trades that secret for a fresh
 * identity on the server.
 *
 * Flow:
 *   1. Generate a brand-new BIP-39 recovery phrase locally.
 *   2. Derive Ed25519 + X25519 keypairs from it.
 *   3. POST `me.replaceIdentityWithDailyPassword` — server verifies
 *      the password, atomically rotates both pubkeys on the user
 *      row, and wipes all old prekeys. Wrong password → UNAUTHORIZED.
 *   4. Persist the new phrase + derived identity to IndexedDB so the
 *      user only does this once per browser. Saved as
 *      `iv: "phrase-derived"` so the standard phrase-unlock path
 *      works on subsequent visits.
 *   5. Upload a fresh prekey bundle so peers can complete X3DH with
 *      the new identity immediately.
 *
 * Returns BOTH the unlocked identity AND the freshly generated
 * recovery phrase, because the caller MUST display the phrase to the
 * user before the gate closes — losing it again is the only way
 * they can lock themselves out for good.
 *
 * IMPORTANT: This is destructive on the server side. Old chat history
 * is unrecoverable; peers will see a "safety number changed" warning.
 * The caller must already have warned the user.
 */
export async function recoverIdentityWithDailyPassword(
  verificationPassword: string,
  userId: string,
): Promise<{ identity: UnlockedIdentity; newPhrase: string }> {
  const newPhrase = generateRecoveryPhrase();
  const ed = deriveIdentityFromPhrase(newPhrase);
  const { privateKey: x25519Priv } = deriveX25519FromPhrase(newPhrase);
  const x25519Pub = x25519PublicKeyFromPrivate(x25519Priv);

  // Server: verify password + rotate identity atomically. Throws
  // UNAUTHORIZED on wrong password, PRECONDITION_FAILED if no daily
  // password was ever set, TOO_MANY_REQUESTS on abuse.
  try {
    await trpcClientProxy().me.replaceIdentityWithDailyPassword.mutate({
      verificationPassword,
      newIdentityPubkey: bytesToBase64(ed.publicKey),
      newX25519Pubkey: bytesToBase64(x25519Pub),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Re-throw with a friendlier message; UnlockGate will surface it.
    if (/unauthorized|wrong verification password/i.test(msg)) {
      throw new Error("Wrong verification password.");
    }
    if (/precondition|doesn't have a daily/i.test(msg)) {
      throw new Error(
        "This account doesn't have a daily verification password set up. Please use your recovery phrase instead.",
      );
    }
    if (/too many/i.test(msg)) {
      throw new Error("Too many attempts. Please wait a few minutes.");
    }
    throw new Error(`Couldn't verify with the server: ${msg}`);
  }

  await saveIdentity({
    id: "self",
    userId,
    encPrivateKey: bytesToBase64(ed.privateKey),
    iv: "phrase-derived",
    salt: "phrase-derived",
    publicKey: bytesToBase64(ed.publicKey),
    encX25519PrivateKey: bytesToBase64(x25519Priv),
    iv2: "phrase-derived",
    salt2: "phrase-derived",
    x25519PublicKey: bytesToBase64(x25519Pub),
    recoveryPhrase: newPhrase,
    createdAt: new Date().toISOString(),
  });

  // Best-effort prekey upload — server already wiped the old ones,
  // so until this succeeds peers can't claim a bundle for us.
  try {
    const bundle = await buildPrekeyBundle({
      identityPrivateKey: ed.privateKey,
      numOneTime: 20,
      freshStart: true,
    });
    await trpcClientProxy().prekeys.upload.mutate(bundle);
  } catch (err) {
    console.warn("Prekey upload failed during daily-password recovery", err);
  }

  return {
    identity: {
      userId,
      ed25519: ed,
      x25519: { privateKey: x25519Priv, publicKey: x25519Pub },
    },
    newPhrase,
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
