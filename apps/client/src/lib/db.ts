import Dexie, { type Table } from "dexie";

/**
 * Local device storage. The identity private key is stored encrypted
 * (AES-GCM, key derived from Backup PIN with Argon2id).
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

export class VeilDB extends Dexie {
  identity!: Table<IdentityRecord, "self">;

  constructor() {
    super("veil");
    this.version(1).stores({
      identity: "id",
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
}
