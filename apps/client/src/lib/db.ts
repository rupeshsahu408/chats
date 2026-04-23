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
  /** Text body (or caption for media). Empty string for media-only. */
  plaintext: string;
  createdAt: string;
  /**
   * For outbound: 'pending' | 'sent' | 'delivered' | 'failed' | 'read'.
   * For inbound: 'received'.
   * 'delivered' = peer device received it. 'read' = peer opened it.
   */
  status: "pending" | "sent" | "delivered" | "failed" | "received" | "read";
  /** When the recipient's device acknowledged receipt (delivery receipt). */
  deliveredAt?: string;
  /** When the recipient (or for outbound: us) read it. */
  readAt?: string;
  /**
   * Disappearing-message expiry. Both ends compute the same value from
   * the envelope. Once it's in the past the row is deleted locally and
   * the server-side row is reaped by the sweeper.
   */
  expiresAt?: string;
  /**
   * View-once: client deletes the message + media as soon as the
   * recipient opens it.
   */
  viewOnce?: boolean;
  /** Set when the recipient has opened a view-once item. */
  viewedAt?: string;
  /** Optional in-envelope link preview (Phase 2). */
  linkPreview?: {
    url: string;
    resolvedUrl?: string | null;
    title?: string | null;
    description?: string | null;
    siteName?: string | null;
    imageUrl?: string | null;
  };
  /** Optional media attachment (Phase 5). */
  attachment?: {
    kind: "image" | "voice";
    blobId: string;
    /** AES-GCM key, base64. Stored locally only. */
    key: string;
    mime: string;
    sizeBytes: number;
    durationMs?: number;
    width?: number;
    height?: number;
    /** Inline thumbnail (base64 JPEG). Images only. */
    thumbB64?: string;
  };
  /**
   * Reply reference: when this message is a reply, points back to the
   * original message that's being quoted. `serverId` is the original
   * message's server id; `body` is a short cached preview.
   */
  replyTo?: {
    serverId: string;
    body: string;
    /** "out" = quoted msg was sent by me; "in" = sent by peer. */
    dir: "in" | "out";
  };
  /**
   * Tombstone for "Delete for everyone". When true, the message body
   * and attachment are wiped locally and the bubble renders as
   * "🚫 This message was deleted".
   */
  deleted?: boolean;
  /**
   * Per-user emoji reactions. Keyed by user id, value is the emoji
   * grapheme. WhatsApp-style: each user has at most one reaction.
   */
  reactions?: Record<string, string>;
  /**
   * ISO timestamp of the most recent edit. When set, the bubble shows
   * an "(edited)" label. Edits replace `plaintext` in place.
   */
  editedAt?: string;
  /** Local-only: starred (bookmarked) by the current user. */
  starred?: boolean;
  /** Local-only: pinned to the top of this thread (one per chat). */
  pinned?: boolean;
}

/** Per-peer chat preferences (TTL, view-once default, biometric lock). */
export interface ChatPrefRecord {
  peerId: string;
  /**
   * Default TTL applied to outgoing messages, in seconds. 0 / undefined = off.
   */
  ttlSeconds?: number;
  /**
   * Auto-delete messages from this device a set number of seconds after they
   * are seen (read). 0 / undefined = off. Applies to inbound messages only on
   * the receiver's device.
   */
  seenTtlSeconds?: number;
  /** Whether new images default to view-once. */
  viewOnceDefault?: boolean;
  /** WebAuthn credential id (base64url) required to open this thread. */
  biometricCredentialId?: string;
  /** Pin this conversation to the top of the chats list. */
  pinnedToTop?: boolean;
  /** Mute notifications until this ISO timestamp. Empty = not muted. */
  mutedUntil?: string;
  updatedAt: string;
}

/**
 * Global preferences (key = "self"). Stealth toggles + screenshot blur.
 */
export interface UserPrefRecord {
  id: "self";
  /** Send read receipts when we open a message. Default true. */
  readReceiptsEnabled: boolean;
  /** Send typing indicators while composing. Default true. */
  typingIndicatorsEnabled: boolean;
  /** Blur the entire app when the tab loses focus. Default true. */
  screenshotBlurEnabled: boolean;
  /** Require biometric/passkey on app launch. Default false. */
  appLockEnabled: boolean;
  updatedAt: string;
}

/**
 * Cached *decrypted* identity private keys, so the user only enters their
 * PIN / recovery phrase once per browser. Tradeoff: anyone with access to
 * this browser can read these keys without the PIN. Wiped on explicit
 * logout or wipe-device.
 */
export interface UnlockedIdentityRecord {
  id: "self";
  userId: string;
  /** Base64 raw 32-byte Ed25519 private key. */
  ed25519PrivateKey: string;
  /** Base64 raw 32-byte Ed25519 public key. */
  ed25519PublicKey: string;
  /** Base64 raw 32-byte X25519 private key. */
  x25519PrivateKey: string;
  /** Base64 raw 32-byte X25519 public key. */
  x25519PublicKey: string;
  savedAt: string;
}

/* ─────────── Phase 7: Group chat local state ─────────── */

/** Per-(group, sender, epoch) sender-key chain state. */
export interface GroupSenderKeyRecord {
  /** Composite key: `${groupId}:${senderUserId}:${epoch}`. */
  id: string;
  groupId: string;
  senderUserId: string;
  epoch: number;
  /** Base64 32-byte current chain key. */
  chainKey: string;
  /** Next counter for sender; or expected counter for receiver. */
  n: number;
  /** Skipped message keys, JSON-serialised `{ counter: base64 }`. */
  skipped: string;
  updatedAt: string;
}

/** Per-group plaintext message log (this device only). */
export interface GroupMessageRecord {
  id?: number;
  groupId: string;
  /** Server message id (one of the fan-out legs). For our own outbound, we assign the first leg. */
  serverId: string | null;
  /** Stable de-dupe key: `${senderUserId}:${epoch}:${counter}`. */
  dedupKey: string;
  senderUserId: string;
  /** "in" if someone else sent it; "out" if I did. */
  direction: "in" | "out";
  plaintext: string;
  createdAt: string;
  status: "pending" | "sent" | "failed" | "received";
  expiresAt?: string;
  attachment?: ChatMessageRecord["attachment"];
  linkPreview?: ChatMessageRecord["linkPreview"];
  /** Present for messages of type "poll". */
  pollData?: {
    pollId: string;
    question: string;
    choices: string[];
  };
  /** Present for messages of type "poll_vote". */
  pollVoteData?: {
    pollId: string;
    /** Index into choices array. -1 means remove vote. */
    choiceIdx: number;
  };
  /** @mention user-ids embedded in the message, extracted at ingest time. */
  mentions?: string[];
}

/** A message scheduled to be sent at a future time (1:1 chats). */
export interface ScheduledMessageRecord {
  id?: number;
  peerId: string;
  text: string;
  /** ISO timestamp when the message should be sent. */
  scheduledFor: string;
  /** Whether the message has already been sent. */
  sent: boolean;
  createdAt: string;
  /** ISO timestamp when the message was actually delivered (set on success). */
  sentAt?: string;
  /** Number of failed send attempts so far. */
  attempts?: number;
  /** ISO timestamp of the most recent attempt. */
  lastAttemptAt?: string;
  /** Last error message, if the most recent attempt failed. */
  lastError?: string;
}

export class VeilDB extends Dexie {
  identity!: Table<IdentityRecord, "self">;
  prekeys!: Table<PrekeyPrivateRecord, string>;
  chatSessions!: Table<ChatSessionRecord, string>;
  chatMessages!: Table<ChatMessageRecord, number>;
  unlocked!: Table<UnlockedIdentityRecord, "self">;
  chatPrefs!: Table<ChatPrefRecord, string>;
  userPrefs!: Table<UserPrefRecord, "self">;
  groupSenderKeys!: Table<GroupSenderKeyRecord, string>;
  groupMessages!: Table<GroupMessageRecord, number>;
  scheduledMessages!: Table<ScheduledMessageRecord, number>;

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
    this.version(4).stores({
      identity: "id",
      prekeys: "id, kind, keyId",
      chatSessions: "peerId, updatedAt",
      chatMessages: "++id, peerId, createdAt, serverId",
      unlocked: "id",
    });
    // v5: chatMessages gains an optional `attachment` field. No index
    // change needed — the new column is just an additional property.
    this.version(5).stores({
      identity: "id",
      prekeys: "id, kind, keyId",
      chatSessions: "peerId, updatedAt",
      chatMessages: "++id, peerId, createdAt, serverId",
      unlocked: "id",
    });
    // v6 — Phase 2: TTL/read/view-once on chatMessages (no new indices)
    // + per-peer chatPrefs + global userPrefs.
    this.version(6).stores({
      identity: "id",
      prekeys: "id, kind, keyId",
      chatSessions: "peerId, updatedAt",
      chatMessages: "++id, peerId, createdAt, serverId, expiresAt",
      unlocked: "id",
      chatPrefs: "peerId, updatedAt",
      userPrefs: "id",
    });
    // v7 — Phase 7: group chats. Sender-key state + per-group log.
    this.version(7).stores({
      identity: "id",
      prekeys: "id, kind, keyId",
      chatSessions: "peerId, updatedAt",
      chatMessages: "++id, peerId, createdAt, serverId, expiresAt",
      unlocked: "id",
      chatPrefs: "peerId, updatedAt",
      userPrefs: "id",
      groupSenderKeys: "id, [groupId+senderUserId+epoch], groupId, senderUserId",
      groupMessages: "++id, groupId, createdAt, serverId, dedupKey, expiresAt",
    });
    // v8 — Phase 1 polish: edit/star/pin per message. New optional
    // fields only; no schema-level index changes required.
    this.version(8).stores({
      identity: "id",
      prekeys: "id, kind, keyId",
      chatSessions: "peerId, updatedAt",
      chatMessages: "++id, peerId, createdAt, serverId, expiresAt",
      unlocked: "id",
      chatPrefs: "peerId, updatedAt",
      userPrefs: "id",
      groupSenderKeys: "id, [groupId+senderUserId+epoch], groupId, senderUserId",
      groupMessages: "++id, groupId, createdAt, serverId, dedupKey, expiresAt",
    });
    // v9 — Message scheduling + group polls + @mentions.
    // groupMessages gains optional pollData/pollVoteData/mentions fields (no index change).
    // New scheduledMessages table for locally-queued scheduled 1:1 messages.
    this.version(9).stores({
      identity: "id",
      prekeys: "id, kind, keyId",
      chatSessions: "peerId, updatedAt",
      chatMessages: "++id, peerId, createdAt, serverId, expiresAt",
      unlocked: "id",
      chatPrefs: "peerId, updatedAt",
      userPrefs: "id",
      groupSenderKeys: "id, [groupId+senderUserId+epoch], groupId, senderUserId",
      groupMessages: "++id, groupId, createdAt, serverId, dedupKey, expiresAt",
      scheduledMessages: "++id, peerId, scheduledFor, sent",
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
  await db.unlocked.clear();
  await db.chatPrefs.clear();
  await db.userPrefs.clear();
  await db.groupSenderKeys.clear();
  await db.groupMessages.clear();
  await db.scheduledMessages.clear();
}

/* ─────────── Scheduled messages ─────────── */

export async function saveScheduledMessage(
  rec: Omit<ScheduledMessageRecord, "id">,
): Promise<number> {
  return (await db.scheduledMessages.add(rec)) as number;
}

export async function getPendingScheduledMessages(
  peerId: string,
): Promise<ScheduledMessageRecord[]> {
  return await db.scheduledMessages
    .where("peerId")
    .equals(peerId)
    .filter((r) => !r.sent)
    .toArray();
}

export async function getAllPendingScheduledMessages(): Promise<ScheduledMessageRecord[]> {
  return await db.scheduledMessages
    .filter((r) => !r.sent)
    .toArray();
}

export async function markScheduledMessageSent(id: number): Promise<void> {
  await db.scheduledMessages.update(id, {
    sent: true,
    sentAt: new Date().toISOString(),
    lastError: undefined,
  });
}

export async function markScheduledMessageFailed(
  id: number,
  errorMessage: string,
): Promise<void> {
  const rec = await db.scheduledMessages.get(id);
  await db.scheduledMessages.update(id, {
    attempts: (rec?.attempts ?? 0) + 1,
    lastAttemptAt: new Date().toISOString(),
    lastError: errorMessage,
  });
}

export async function deleteScheduledMessage(id: number): Promise<void> {
  await db.scheduledMessages.delete(id);
}

/**
 * Remove records that were already delivered more than `olderThanMs`
 * milliseconds ago. Keeps the local DB tidy without losing recent history.
 */
export async function purgeOldSentScheduledMessages(
  olderThanMs: number = 7 * 24 * 60 * 60 * 1000,
): Promise<number> {
  const cutoff = Date.now() - olderThanMs;
  const stale = await db.scheduledMessages
    .filter(
      (r) =>
        !!r.sent &&
        !!r.sentAt &&
        new Date(r.sentAt).getTime() < cutoff,
    )
    .toArray();
  for (const rec of stale) {
    if (rec.id !== undefined) await db.scheduledMessages.delete(rec.id);
  }
  return stale.length;
}

/* ─────────── Phase 7: Group helpers ─────────── */

export function senderKeyId(
  groupId: string,
  senderUserId: string,
  epoch: number,
): string {
  return `${groupId}:${senderUserId}:${epoch}`;
}

export async function getSenderKey(
  groupId: string,
  senderUserId: string,
  epoch: number,
): Promise<GroupSenderKeyRecord | undefined> {
  return await db.groupSenderKeys.get(senderKeyId(groupId, senderUserId, epoch));
}

export async function putSenderKey(
  rec: GroupSenderKeyRecord,
): Promise<void> {
  await db.groupSenderKeys.put(rec);
}

export async function deleteSenderKeysForGroup(groupId: string): Promise<void> {
  await db.groupSenderKeys.where("groupId").equals(groupId).delete();
}

export async function appendGroupMessage(
  rec: Omit<GroupMessageRecord, "id">,
): Promise<number> {
  return (await db.groupMessages.add(rec)) as number;
}

export async function hasGroupMessageDedup(dedupKey: string): Promise<boolean> {
  return (await db.groupMessages.where("dedupKey").equals(dedupKey).count()) > 0;
}

export async function setGroupMessageStatus(
  localId: number,
  status: GroupMessageRecord["status"],
  serverId?: string,
): Promise<void> {
  const patch: Partial<GroupMessageRecord> = { status };
  if (serverId) patch.serverId = serverId;
  await db.groupMessages.update(localId, patch);
}

export async function listGroupMessages(
  groupId: string,
): Promise<GroupMessageRecord[]> {
  const rows = await db.groupMessages
    .where("groupId")
    .equals(groupId)
    .toArray();
  return rows.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}

export async function deleteExpiredGroupMessages(): Promise<void> {
  const nowIso = new Date().toISOString();
  await db.groupMessages
    .where("expiresAt")
    .belowOrEqual(nowIso)
    .delete();
}

/* ─────────── Chat prefs (per-peer) ─────────── */

export async function getChatPref(peerId: string): Promise<ChatPrefRecord | undefined> {
  return await db.chatPrefs.get(peerId);
}

export async function setChatPref(
  peerId: string,
  patch: Partial<Omit<ChatPrefRecord, "peerId" | "updatedAt">>,
): Promise<void> {
  const existing = (await db.chatPrefs.get(peerId)) ?? { peerId, updatedAt: new Date().toISOString() };
  const next: ChatPrefRecord = { ...existing, ...patch, peerId, updatedAt: new Date().toISOString() };
  await db.chatPrefs.put(next);
}

/* ─────────── User prefs (global) ─────────── */

const DEFAULT_USER_PREFS: UserPrefRecord = {
  id: "self",
  readReceiptsEnabled: true,
  typingIndicatorsEnabled: true,
  screenshotBlurEnabled: true,
  appLockEnabled: false,
  updatedAt: new Date(0).toISOString(),
};

export async function getUserPrefs(): Promise<UserPrefRecord> {
  const r = await db.userPrefs.get("self");
  return r ?? DEFAULT_USER_PREFS;
}

export async function setUserPrefs(patch: Partial<Omit<UserPrefRecord, "id" | "updatedAt">>): Promise<UserPrefRecord> {
  const existing = await getUserPrefs();
  const next: UserPrefRecord = { ...existing, ...patch, id: "self", updatedAt: new Date().toISOString() };
  await db.userPrefs.put(next);
  return next;
}

/* ─────────── Disappearing-message helpers ─────────── */

export async function deleteExpiredChatMessages(): Promise<number> {
  const now = new Date().toISOString();
  const expired = await db.chatMessages
    .where("expiresAt")
    .below(now)
    .toArray();
  if (expired.length === 0) return 0;
  await db.chatMessages.bulkDelete(expired.map((m) => m.id!).filter((x) => x !== undefined));
  return expired.length;
}

export async function markChatMessageDelivered(
  serverId: string,
  deliveredAt: string,
): Promise<void> {
  const row = await db.chatMessages.where("serverId").equals(serverId).first();
  if (!row || row.id === undefined) return;
  // Only promote to "delivered" if the message hasn't already been read.
  if (row.status === "sent" || row.status === "pending") {
    await db.chatMessages.update(row.id, { status: "delivered", deliveredAt });
  }
}

export async function markChatMessageRead(
  serverId: string,
  readAt: string,
): Promise<void> {
  const row = await db.chatMessages.where("serverId").equals(serverId).first();
  if (!row || row.id === undefined) return;
  const patch: Partial<ChatMessageRecord> = { status: "read", readAt };
  // Two-sided "delete-after-seen": if this is OUR outbound message and we
  // have a seen TTL configured for this peer, stamp expiresAt so our own
  // copy auto-deletes after the chosen duration once the recipient has
  // actually read it. Receiver-side stamping happens in ChatThreadPage
  // when inbound messages are marked read.
  if (row.direction === "out" && !row.expiresAt) {
    const pref = await db.chatPrefs.get(row.peerId);
    const secs = pref?.seenTtlSeconds ?? 0;
    if (secs > 0) {
      const base = new Date(readAt).getTime();
      const due = Number.isFinite(base) ? base : Date.now();
      patch.expiresAt = new Date(due + secs * 1000).toISOString();
    }
  }
  await db.chatMessages.update(row.id, patch);
}

export async function deleteChatMessageById(id: number): Promise<void> {
  await db.chatMessages.delete(id);
}

/**
 * Hard-delete the local row matching a given server id. Used by the
 * "Unsend" flow so the message disappears completely on the receiver's
 * device with no tombstone or trace in the UI.
 */
export async function deleteChatMessageByServerId(
  serverId: string,
): Promise<void> {
  const row = await db.chatMessages.where("serverId").equals(serverId).first();
  if (row && row.id !== undefined) await db.chatMessages.delete(row.id);
}

/**
 * Replace a chat message with a "deleted for everyone" tombstone. Wipes
 * body, attachment, link preview and reply ref so nothing of the
 * original is recoverable from the local row.
 */
export async function tombstoneChatMessageByServerId(
  serverId: string,
): Promise<void> {
  const row = await db.chatMessages.where("serverId").equals(serverId).first();
  if (!row || row.id === undefined) return;
  await db.chatMessages.update(row.id, {
    deleted: true,
    plaintext: "",
    attachment: undefined,
    linkPreview: undefined,
    replyTo: undefined,
    reactions: undefined,
  });
}

export async function tombstoneChatMessageById(id: number): Promise<void> {
  await db.chatMessages.update(id, {
    deleted: true,
    plaintext: "",
    attachment: undefined,
    linkPreview: undefined,
    replyTo: undefined,
    reactions: undefined,
  });
}

/**
 * Apply a reaction event from a peer (or our own echo) to the targeted
 * message. An empty `emoji` clears that user's reaction. The whole
 * `reactions` map is rewritten atomically so concurrent updates from
 * the same user always pick the latest value.
 */
/**
 * Apply an inbound (or our own echoed) edit to a chat row identified
 * by its server id. Replaces the plaintext body and stamps `editedAt`.
 * No-op for media messages, deleted messages, or rows we don't have.
 */
export async function applyEditByServerId(
  targetServerId: string,
  newBody: string,
  editedAt: string,
): Promise<void> {
  const row = await db.chatMessages
    .where("serverId")
    .equals(targetServerId)
    .first();
  if (!row || row.id === undefined) return;
  if (row.deleted) return;
  // Only text-style messages (no attachment) can be edited.
  if (row.attachment) return;
  await db.chatMessages.update(row.id, {
    plaintext: newBody,
    editedAt,
  });
}

/** Toggle the local star flag on a message. */
export async function setChatMessageStarred(
  id: number,
  starred: boolean,
): Promise<void> {
  await db.chatMessages.update(id, { starred });
}

/**
 * Pin a single message to the top of a chat thread. Clears any other
 * pinned message in the same thread (one-pin-per-chat, WhatsApp-style).
 */
export async function setChatMessagePinned(
  id: number,
  peerId: string,
  pinned: boolean,
): Promise<void> {
  if (pinned) {
    // Unpin anything else in this thread first.
    await db.chatMessages
      .where("peerId")
      .equals(peerId)
      .modify((rec) => {
        if (rec.pinned) rec.pinned = false;
      });
  }
  await db.chatMessages.update(id, { pinned });
}

/** Wipe all chat history with a peer (local only). */
export async function clearChatHistory(peerId: string): Promise<void> {
  await db.chatMessages.where("peerId").equals(peerId).delete();
}

export async function applyReactionByServerId(
  targetServerId: string,
  fromUserId: string,
  emoji: string,
): Promise<void> {
  const row = await db.chatMessages
    .where("serverId")
    .equals(targetServerId)
    .first();
  if (!row || row.id === undefined) return;
  const next = { ...(row.reactions ?? {}) };
  if (emoji) next[fromUserId] = emoji;
  else delete next[fromUserId];
  await db.chatMessages.update(row.id, { reactions: next });
}

export async function saveUnlockedIdentity(
  rec: UnlockedIdentityRecord,
): Promise<void> {
  await db.unlocked.put(rec);
}

export async function loadUnlockedIdentity(): Promise<
  UnlockedIdentityRecord | undefined
> {
  return await db.unlocked.get("self");
}

export async function clearUnlockedIdentity(): Promise<void> {
  await db.unlocked.clear();
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
  // Atomic dedupe-on-insert: when a serverId is present we run the lookup
  // and the insert inside a single Dexie transaction, so concurrent
  // ingest paths (live WS + background poll + focus drain) can't all
  // pass the "is this new?" check and each insert their own copy.
  if (rec.serverId) {
    const serverId = rec.serverId;
    return await db.transaction("rw", db.chatMessages, async () => {
      const existing = await db.chatMessages
        .where("serverId")
        .equals(serverId)
        .first();
      if (existing && existing.id !== undefined) return existing.id;
      return (await db.chatMessages.add(rec as ChatMessageRecord)) as number;
    });
  }
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
