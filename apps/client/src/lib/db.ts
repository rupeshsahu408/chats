import Dexie, { type Table } from "dexie";

/**
 * Local device storage. The identity private key is stored encrypted
 * (AES-GCM, key derived from Backup PIN with Argon2id).
 *
 * One-time prekey private keys are stored unencrypted but are
 * device-bound (IndexedDB origin-isolated) and ephemeral — they're
 * deleted as peers consume them.
 */

export interface IdentityRecord {
  id: "self";
  userId: string;
  /** Base64 of encrypted private key blob (ciphertext). */
  encPrivateKey: string;
  /** Base64 of AES-GCM IV. */
  iv: string;
  /** Base64 of Argon2id salt. */
  salt: string;
  /** Base64 of raw 32-byte public key (uploaded to server). */
  publicKey: string;
  createdAt: string;
}

/** Local copy of a generated prekey so we can decrypt incoming X3DH later. */
export interface PrekeyPrivateRecord {
  /** Composite key: `spk:<id>` or `otpk:<id>` for the keyId. */
  id: string;
  kind: "signed" | "one-time";
  keyId: number;
  /** Base64 of raw 32-byte private key. */
  privateKey: string;
  /** Base64 of raw 32-byte public key. */
  publicKey: string;
  createdAt: string;
}

export class VeilDB extends Dexie {
  identity!: Table<IdentityRecord, "self">;
  prekeys!: Table<PrekeyPrivateRecord, string>;

  constructor() {
    super("veil");
    this.version(1).stores({ identity: "id" });
    this.version(2).stores({
      identity: "id",
      prekeys: "id, kind, keyId",
    });
  }
}

export const db = new VeilDB();

export async function saveIdentity(record: IdentityRecord): Promise<void> {
  await db.identity.put(record);
}

export async function loadIdentity(): Promise<IdentityRecord | undefined> {
  return await db.identity.get("self");
}

export async function clearIdentity(): Promise<void> {
  await db.identity.clear();
  await db.prekeys.clear();
}

export async function saveSignedPrekey(rec: {
  keyId: number;
  privateKey: string;
  publicKey: string;
}): Promise<void> {
  // Replace any previously stored signed prekey.
  await db.prekeys.where("kind").equals("signed").delete();
  await db.prekeys.put({
    id: `spk:${rec.keyId}`,
    kind: "signed",
    keyId: rec.keyId,
    privateKey: rec.privateKey,
    publicKey: rec.publicKey,
    createdAt: new Date().toISOString(),
  });
}

export async function saveOneTimePrekeys(
  recs: Array<{ keyId: number; privateKey: string; publicKey: string }>,
): Promise<void> {
  await db.prekeys.bulkPut(
    recs.map((r) => ({
      id: `otpk:${r.keyId}`,
      kind: "one-time" as const,
      keyId: r.keyId,
      privateKey: r.privateKey,
      publicKey: r.publicKey,
      createdAt: new Date().toISOString(),
    })),
  );
}

export async function getOneTimePrekeyCount(): Promise<number> {
  return await db.prekeys.where("kind").equals("one-time").count();
}

export async function getMaxOneTimePrekeyId(): Promise<number> {
  const all = await db.prekeys.where("kind").equals("one-time").toArray();
  let max = 0;
  for (const r of all) if (r.keyId > max) max = r.keyId;
  return max;
}
