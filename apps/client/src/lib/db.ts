import Dexie, { type Table } from "dexie";

/**
 * Local device storage.
 *
 *   - identity: long-term Ed25519 + X25519 identity, both encrypted with
 *     the user's PIN (Argon2id-derived AES-GCM key). The Ed25519 half is
 *     used for signatures + fingerprint; the X25519 half for X3DH ECDH.
 *   - prekeys: signed prekey + one-time prekeys, plaintext (origin-isolated).
 *     OTPKs are deleted as peers consume them so the keys can't be reused.
 *   - chatSessions: serialized Double Ratchet state per peer.
 *   - chatMessages: per-peer plaintext message log (only on this device).
 */

export interface IdentityRecord {
  id: "self";
  userId: string;
  /** Base64 of encrypted Ed25519 private key (ciphertext). */
  encPrivateKey: string;
  /** Base64 of AES-GCM IV for `encPrivateKey`. */
  iv: string;
  /** Base64 of Argon2id salt for `encPrivateKey`. */
  salt: string;
  /** Base64 of raw 32-byte Ed25519 public key. */
  publicKey: string;
  /** Base64 of encrypted X25519 private key. Phase 3+. */
  encX25519PrivateKey?: string;
  /** Base64 of AES-GCM IV for `encX25519PrivateKey`. Phase 3+. */
  iv2?: string;
  /** Base64 of Argon2id salt for `encX25519PrivateKey`. Phase 3+. */
  salt2?: string;
  /** Base64 of raw 32-byte X25519 public key. Phase 3+. */
  x25519PublicKey?: string;
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

/** Per-peer serialized Double Ratchet state. */
export interface ChatSessionRecord {
  peerId: string;
  /** JSON blob produced by `serializeRatchet`. */
  state: string;
  updatedAt: string;
}

/** Per-peer plaintext message log (this device only). */
export interface ChatMessageRecord {
  /** Auto-incremented local id. */
  id?: number;
  peerId: string;
  /** Server message id when known, otherwise a local uuid. */
  serverId: string | null;
  direction: "in" | "out";
  plaintext: string;
  createdAt: string;
  /** For outbound: 'pending' | 'sent' | 'failed'. For inbound: 'received'. */
  status: "pending" | "sent" | "failed" | "received";
}

export class VeilDB extends Dexie {
  identity!: Table<IdentityRecord, "self">;
  prekeys!: Table<PrekeyPrivateRecord, string>;
  chatSessions!: Table<ChatSessionRecord, string>;
  chatMessages!: Table<ChatMessageRecord, number>;

  constructor() {
    super("veil");
    this.version(1).stores({ identity: "id" });
    this.version(2).stores({
      identity: "id",
      prekeys: "id, kind, keyId",
    });
    this.version(3).stores({
      identity: "id",
      prekeys: "id, kind, keyId",
      chatSessions: "peerId, updatedAt",
      chatMessages: "++id, peerId, createdAt, serverId",
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
  await db.chatSessions.clear();
  await db.chatMessages.clear();
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

export async function clearAllOneTimePrekeys(): Promise<void> {
  await db.prekeys.where("kind").equals("one-time").delete();
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

export async function getSignedPrekey(
  keyId: number,
): Promise<PrekeyPrivateRecord | undefined> {
  return await db.prekeys.get(`spk:${keyId}`);
}

export async function getOneTimePrekey(
  keyId: number,
): Promise<PrekeyPrivateRecord | undefined> {
  return await db.prekeys.get(`otpk:${keyId}`);
}

export async function consumeOneTimePrekey(keyId: number): Promise<void> {
  await db.prekeys.delete(`otpk:${keyId}`);
}

export async function appendChatMessage(
  rec: Omit<ChatMessageRecord, "id">,
): Promise<number> {
  return (await db.chatMessages.add(rec as ChatMessageRecord)) as number;
}

export async function listChatMessages(
  peerId: string,
): Promise<ChatMessageRecord[]> {
  return await db.chatMessages
    .where("peerId")
    .equals(peerId)
    .sortBy("createdAt");
}

export async function hasChatMessageWithServerId(
  serverId: string,
): Promise<boolean> {
  const found = await db.chatMessages
    .where("serverId")
    .equals(serverId)
    .first();
  return !!found;
}

export async function getEarliestChatMessageTime(
  peerId: string,
): Promise<string | null> {
  const earliest = await db.chatMessages
    .where("peerId")
    .equals(peerId)
    .toArray();
  if (earliest.length === 0) return null;
  let min = earliest[0]!.createdAt;
  for (const m of earliest) if (m.createdAt < min) min = m.createdAt;
  return min;
}

export async function setChatMessageStatus(
  id: number,
  status: ChatMessageRecord["status"],
  serverId?: string,
): Promise<void> {
  const patch: Partial<ChatMessageRecord> = { status };
  if (serverId) patch.serverId = serverId;
  await db.chatMessages.update(id, patch);
}
