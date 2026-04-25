import {
  base64ToBytes,
  bytesToBase64,
  decryptWithPin,
  encryptWithPin,
  deriveIdentityFromPhrase,
  deriveX25519FromPhrase,
  isValidRecoveryPhrase,
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
 * Encrypt the user's BIP-39 recovery phrase with their daily verification
 * password (Argon2id + AES-GCM). Returns the three base64 strings the
 * server stores as an opaque blob.
 *
 * The server can never decrypt this — the key is derived locally from
 * a password the server only ever sees as a bcrypt hash. The blob is
 * shipped to the server at sign-up, when the daily password is rotated
 * (re-encrypted with the new password), and opportunistically alongside
 * each successful daily-password verification (back-fill for legacy
 * accounts that pre-date this feature).
 */
export async function encryptRecoveryPhraseForServer(
  phrase: string,
  verificationPassword: string,
): Promise<{ ciphertext: string; iv: string; salt: string }> {
  const blob = await encryptWithPin(
    verificationPassword,
    new TextEncoder().encode(phrase),
  );
  return {
    ciphertext: bytesToBase64(blob.ciphertext),
    iv: bytesToBase64(blob.iv),
    salt: bytesToBase64(blob.salt),
  };
}

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
 * Daily-password recovery on a brand-new device — NON-DESTRUCTIVE.
 *
 * Used when a Random-ID account holder has lost (or never recorded)
 * their 12-word recovery phrase but still knows the daily verification
 * password they set at sign-up. Trades that secret for the encrypted
 * backup of the ORIGINAL recovery phrase, then rebuilds the original
 * identity from it — same keys, same chat history, no peer
 * "safety-number changed" warning, recovery phrase unchanged.
 *
 * Flow:
 *   1. POST `me.fetchEncryptedRecoveryPhrase` — server verifies the
 *      daily password (bcrypt) and returns the encrypted blob the
 *      client uploaded at sign-up. UNAUTHORIZED on wrong password,
 *      PRECONDITION_FAILED if no backup is on file (legacy account).
 *   2. Decrypt the blob locally with Argon2id(password, salt) — same
 *      KDF used at upload time. Wrong password = decrypt throws =
 *      we surface a friendly "wrong password" message even though
 *      the bcrypt check passed (unlikely but defensive).
 *   3. Verify the decrypted bytes are a valid BIP-39 mnemonic.
 *   4. Derive the original Ed25519 + X25519 keypairs from the phrase
 *      and persist them locally so the user only does this once per
 *      browser.
 *   5. Best-effort prekey re-upload (the previous device's one-time
 *      prekeys are either consumed or unknown to us — refreshing them
 *      keeps inbound first-contacts working).
 *
 * The caller does NOT need to show the user a "new phrase" screen:
 * the original phrase is preserved, both on the server (still
 * decryptable with the same daily password) and now on this device.
 */
export async function recoverIdentityWithDailyPassword(
  verificationPassword: string,
  userId: string,
): Promise<UnlockedIdentity> {
  let blob: { ciphertext: string; iv: string; salt: string };
  try {
    const r =
      await trpcClientProxy().me.fetchEncryptedRecoveryPhrase.mutate({
        verificationPassword,
      });
    blob = r.encryptedRecoveryPhrase;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/unauthorized|wrong verification password/i.test(msg)) {
      throw new Error("Wrong verification password.");
    }
    if (/no encrypted recovery backup/i.test(msg)) {
      throw new Error(
        "This account has no encrypted recovery backup yet. Sign in once on a device that has your phrase, then try again here — or use your recovery phrase to recover this device.",
      );
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

  let phrase: string;
  try {
    const plaintext = await decryptWithPin(verificationPassword, {
      ciphertext: base64ToBytes(blob.ciphertext),
      iv: base64ToBytes(blob.iv),
      salt: base64ToBytes(blob.salt),
    });
    phrase = new TextDecoder().decode(plaintext).trim();
  } catch {
    // Should be unreachable after the bcrypt check, but a stale or
    // tampered blob would land here.
    throw new Error(
      "Couldn't decrypt your recovery backup. Try signing in on a device that has your phrase to refresh the backup, or use your recovery phrase here.",
    );
  }

  if (!isValidRecoveryPhrase(phrase)) {
    throw new Error(
      "Recovery backup is corrupted. Please use your recovery phrase to recover this device.",
    );
  }

  const ed = deriveIdentityFromPhrase(phrase);
  const { privateKey: x25519Priv } = deriveX25519FromPhrase(phrase);
  const x25519Pub = x25519PublicKeyFromPrivate(x25519Priv);

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

  // Best-effort prekey re-upload — the previous device's one-time
  // prekeys are either consumed or unknown to us, so refreshing keeps
  // inbound first-contacts working. Failure is non-fatal.
  try {
    const bundle = await buildPrekeyBundle({
      identityPrivateKey: ed.privateKey,
      numOneTime: 20,
      freshStart: true,
    });
    await trpcClientProxy().prekeys.upload.mutate(bundle);
  } catch (err) {
    console.warn("Prekey re-upload failed during daily-password recovery", err);
  }

  return {
    userId,
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
