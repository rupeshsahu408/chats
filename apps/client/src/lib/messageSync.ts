import { trpcClientProxy } from "./trpcClientProxy";
import {
  appendChatMessage,
  consumeOneTimePrekey,
  getOneTimePrekey,
  getSignedPrekey,
  setChatMessageStatus,
  hasChatMessageWithServerId,
  getEarliestChatMessageTime,
  markChatMessageDelivered,
  markChatMessageRead,
  deleteExpiredChatMessages,
  tombstoneChatMessageByServerId,
  tombstoneChatMessageById,
  deleteChatMessageByServerId,
  applyReactionByServerId,
  applyEditByServerId,
  db,
} from "./db";
import { decryptFromPeer, encryptToPeer } from "./signal/session";
import { base64ToBytes } from "./crypto";
import { wsMarkDelivered, wsMarkRead } from "./wsClient";
import type { UnlockedIdentity } from "./signal/session";
import type { InboxMessage, HistoryMessage } from "@veil/shared";
import { decodeEnvelope, encodeEnvelope, type ChatEnvelope } from "./messageEnvelope";
import type { ChatMessageRecord } from "./db";
import { getCachedStealthPrefs } from "./stealthPrefs";
import { handleIncomingSenderKey, ingestGroupInboxMessage } from "./groupSync";

function envelopeToRecordFields(
  env: ChatEnvelope,
  serverExpiresAt?: string | null,
): Pick<
  ChatMessageRecord,
  "plaintext" | "attachment" | "viewOnce" | "linkPreview" | "expiresAt" | "replyTo"
> {
  const expiresAt = serverExpiresAt ?? deriveExpiry(env);
  const extras: Pick<
    ChatMessageRecord,
    "viewOnce" | "linkPreview" | "expiresAt" | "replyTo"
  > = {};
  // Narrow: only payload envelopes carry these flags.
  if (env.t === "text" || env.t === "image" || env.t === "voice") {
    if (env.vo) extras.viewOnce = true;
    if (env.lp) extras.linkPreview = env.lp;
    if (env.re) {
      extras.replyTo = {
        serverId: env.re.id,
        body: env.re.body,
        // Sender stamps `dir` from their POV. On the receive side
        // (env.t arrives as inbound), we mirror it: their "out" is our
        // "in". Caller passes the right value via the wrapper below.
        dir: env.re.dir,
      };
    }
  }
  if (expiresAt) extras.expiresAt = expiresAt;

  if (env.t === "text") {
    return { plaintext: env.body, ...extras };
  }
  if (env.t === "image") {
    return {
      plaintext: env.body ?? "",
      attachment: { ...env.media, kind: "image" },
      ...extras,
    };
  }
  if (env.t === "voice") {
    return {
      plaintext: "",
      attachment: { ...env.media, kind: "voice" },
      ...extras,
    };
  }
  // skdm / del / rxn — never persisted as a chat row.
  return { plaintext: "", ...extras };
}

/** Mirror a sender-POV reply ref to the receiver's POV. */
function mirrorReplyForInbound(env: ChatEnvelope): ChatEnvelope {
  if (
    (env.t === "text" || env.t === "image" || env.t === "voice") &&
    env.re
  ) {
    return {
      ...env,
      re: { ...env.re, dir: env.re.dir === "out" ? "in" : "out" },
    };
  }
  return env;
}

/**
 * Side-effect envelopes (delete, reaction) don't materialise as new
 * chat rows — they mutate existing ones. Returns true if the envelope
 * was handled here (caller should not persist a row for it).
 */
async function applySideEffectEnvelope(
  env: ChatEnvelope,
  fromUserId: string,
): Promise<boolean> {
  if (env.t === "del") {
    // "Unsend" — hard-delete on the receiver. No tombstone, no trace.
    await deleteChatMessageByServerId(env.target);
    return true;
  }
  if (env.t === "rxn") {
    await applyReactionByServerId(env.target, fromUserId, env.emoji);
    return true;
  }
  if (env.t === "edit") {
    await applyEditByServerId(env.target, env.body, env.editedAt);
    return true;
  }
  return false;
}

function deriveExpiry(env: ChatEnvelope): string | undefined {
  if (env.t !== "text" && env.t !== "image" && env.t !== "voice") return undefined;
  if (env.ttl && env.ttl > 0) {
    return new Date(Date.now() + env.ttl * 1000).toISOString();
  }
  return undefined;
}

/* ────────────────────────── Inbox / live ────────────────────────── */

async function decryptIncoming(
  identity: UnlockedIdentity,
  m: InboxMessage,
): Promise<string> {
  return decryptFromPeer(
    identity,
    m.senderUserId,
    m.header,
    m.ciphertext,
    {
      spk: async (id) => {
        const rec = await getSignedPrekey(id);
        return rec
          ? {
              privateKey: base64ToBytes(rec.privateKey),
              publicKey: base64ToBytes(rec.publicKey),
            }
          : null;
      },
      opk: async (id) => {
        const rec = await getOneTimePrekey(id);
        return rec
          ? {
              privateKey: base64ToBytes(rec.privateKey),
              publicKey: base64ToBytes(rec.publicKey),
            }
          : null;
      },
      consumeOpk: consumeOneTimePrekey,
    },
  );
}

// In-flight ingest guard: when WS push and a poll drain race for the same
// server message id, the first call claims it here so the second one
// resolves to "duplicate" without touching Dexie or the decrypt path.
const inFlightIngest = new Map<string, Promise<"new" | "duplicate" | "failed">>();

/**
 * After receiving a Sender Key Distribution Message (SKDM), we schedule a
 * short-delay re-poll so any group messages that arrived before their SKDM
 * (and were left un-acked in the inbox) get a chance to decrypt immediately
 * rather than waiting for the next background poll interval.
 */
let _skdmRetryTimeout: ReturnType<typeof setTimeout> | null = null;
let _skdmRetryIdentity: UnlockedIdentity | null = null;

function scheduleSkdmRetryPoll(identity: UnlockedIdentity): void {
  _skdmRetryIdentity = identity;
  if (_skdmRetryTimeout !== null) return; // already pending
  _skdmRetryTimeout = setTimeout(() => {
    _skdmRetryTimeout = null;
    const id = _skdmRetryIdentity;
    _skdmRetryIdentity = null;
    if (id) void pollAndDecrypt(id).catch(() => undefined);
  }, 600); // short delay so all in-flight WS events land first
}

export function ingestInboxMessage(
  identity: UnlockedIdentity,
  m: InboxMessage,
): Promise<"new" | "duplicate" | "failed"> {
  const existing = inFlightIngest.get(m.id);
  if (existing) return existing;
  const p = (async () => {
    try {
      return await ingestInboxMessageInner(identity, m);
    } finally {
      inFlightIngest.delete(m.id);
    }
  })();
  inFlightIngest.set(m.id, p);
  return p;
}

async function ingestInboxMessageInner(
  identity: UnlockedIdentity,
  m: InboxMessage,
): Promise<"new" | "duplicate" | "failed"> {
  // Group fan-out leg: route to group ingestor.
  if (m.groupId) {
    const result = await ingestGroupInboxMessage(m);
    // Only ack if successfully processed. A "failed" result almost always
    // means the Sender Key Distribution Message (SKDM) hasn't arrived yet.
    // Leaving the message un-acked keeps it in the server inbox so it will
    // be retried once the SKDM lands and scheduleSkdmRetryPoll fires.
    if (result !== "failed") {
      if (!wsMarkDelivered([m.id])) {
        void trpcClientProxy()
          .messages.markDelivered.mutate({ ids: [m.id] })
          .catch(() => undefined);
      }
    }
    return result;
  }
  if (await hasChatMessageWithServerId(m.id)) {
    if (!wsMarkDelivered([m.id])) {
      void trpcClientProxy()
        .messages.markDelivered.mutate({ ids: [m.id] })
        .catch(() => undefined);
    }
    return "duplicate";
  }
  try {
    const plaintext = await decryptIncoming(identity, m);
    const env = decodeEnvelope(plaintext);
    if (env.t === "skdm") {
      await handleIncomingSenderKey(m.senderUserId, env);
      if (!wsMarkDelivered([m.id])) {
        void trpcClientProxy()
          .messages.markDelivered.mutate({ ids: [m.id] })
          .catch(() => undefined);
      }
      // Sender key is now stored — schedule a re-poll so any group messages
      // that arrived before this SKDM (and were left un-acked) get retried.
      scheduleSkdmRetryPoll(identity);
      return "new";
    }
    if (await applySideEffectEnvelope(env, m.senderUserId)) {
      if (!wsMarkDelivered([m.id])) {
        void trpcClientProxy()
          .messages.markDelivered.mutate({ ids: [m.id] })
          .catch(() => undefined);
      }
      return "new";
    }
    const inboundEnv = mirrorReplyForInbound(env);
    await appendChatMessage({
      peerId: m.senderUserId,
      serverId: m.id,
      direction: "in",
      ...envelopeToRecordFields(inboundEnv, m.expiresAt),
      createdAt: m.createdAt,
      status: "received",
    });
    if (!wsMarkDelivered([m.id])) {
      void trpcClientProxy()
        .messages.markDelivered.mutate({ ids: [m.id] })
        .catch(() => undefined);
    }
    return "new";
  } catch (err) {
    console.error("Failed to decrypt live message", m.id, err);
    return "failed";
  }
}

/**
 * Pull every undelivered message from the server, decrypt, persist, and
 * ack the batch. Used as a fallback when the WebSocket is disconnected
 * and as a one-shot drain when the user unlocks.
 */
export async function pollAndDecrypt(
  identity: UnlockedIdentity,
): Promise<{ added: number; failed: number }> {
  // Reap any locally-expired messages first so the UI never lingers on
  // a disappearing message past its TTL.
  await deleteExpiredChatMessages().catch(() => undefined);

  const { messages } = await trpcClientProxy().messages.fetchInbox.mutate();
  let added = 0;
  let failed = 0;
  const acked: string[] = [];

  // Process 1:1 messages (which include SKDMs) before group messages.
  // This ensures sender keys are always stored before we attempt to decrypt
  // the group messages that depend on them — fixing the SKDM race condition
  // where a group message arrives in the same inbox batch as its SKDM.
  const sorted = [...messages].sort((a, b) => {
    const aIsGroup = a.groupId ? 1 : 0;
    const bIsGroup = b.groupId ? 1 : 0;
    return aIsGroup - bIsGroup;
  });

  for (const m of sorted) {
    if (m.groupId) {
      const result = await ingestGroupInboxMessage(m);
      // Only ack if processed successfully. Leave "failed" messages un-acked
      // so they remain in the server inbox and are retried on the next poll
      // (by which time the SKDM should have been processed).
      if (result !== "failed") {
        acked.push(m.id);
        if (result === "new") added += 1;
      } else {
        failed += 1;
      }
      continue;
    }
    if (await hasChatMessageWithServerId(m.id)) {
      acked.push(m.id);
      continue;
    }
    try {
      const plaintext = await decryptIncoming(identity, m);
      const env = decodeEnvelope(plaintext);
      if (env.t === "skdm") {
        await handleIncomingSenderKey(m.senderUserId, env);
        acked.push(m.id);
        added += 1;
        continue;
      }
      if (await applySideEffectEnvelope(env, m.senderUserId)) {
        acked.push(m.id);
        added += 1;
        continue;
      }
      const inboundEnv = mirrorReplyForInbound(env);
      await appendChatMessage({
        peerId: m.senderUserId,
        serverId: m.id,
        direction: "in",
        ...envelopeToRecordFields(inboundEnv, m.expiresAt),
        createdAt: m.createdAt,
        status: "received",
      });
      acked.push(m.id);
      added += 1;
    } catch (err) {
      console.error("Failed to decrypt message", m.id, err);
      failed += 1;
    }
  }

  if (acked.length > 0) {
    if (!wsMarkDelivered(acked)) {
      try {
        await trpcClientProxy().messages.markDelivered.mutate({ ids: acked });
      } catch (e) {
        console.warn("markDelivered HTTP fallback failed", e);
      }
    }
  }
  return { added, failed };
}

/* ─────────────────────────── Send ─────────────────────────── */

export async function sendChatMessage(
  identity: UnlockedIdentity,
  peerId: string,
  plaintext: string,
  opts: {
    ttlSeconds?: number;
    linkPreview?: import("./messageEnvelope").EnvelopeLinkPreview;
    replyTo?: import("./messageEnvelope").EnvelopeReplyRef;
  } = {},
): Promise<number> {
  const env: ChatEnvelope = { v: 2, t: "text", body: plaintext };
  if (opts.ttlSeconds && opts.ttlSeconds > 0) env.ttl = opts.ttlSeconds;
  if (opts.linkPreview) env.lp = opts.linkPreview;
  if (opts.replyTo) env.re = opts.replyTo;
  return sendChatEnvelope(identity, peerId, env);
}

/**
 * Send any envelope (text, image, voice). Persists locally as `pending`
 * first so the UI can show it instantly, then encrypts + uploads, then
 * flips the status to `sent`.
 */
export async function sendChatEnvelope(
  identity: UnlockedIdentity,
  peerId: string,
  envelope: ChatEnvelope,
): Promise<number> {
  // Stamp v2 if any of the new fields are present.
  if (
    (envelope.t === "text" || envelope.t === "image" || envelope.t === "voice") &&
    (envelope.ttl || envelope.vo || envelope.lp || envelope.re)
  ) {
    envelope.v = 2;
  }
  const localFields = envelopeToRecordFields(envelope);
  const localId = await appendChatMessage({
    peerId,
    serverId: null,
    direction: "out",
    ...localFields,
    createdAt: new Date().toISOString(),
    status: "pending",
  });

  try {
    const wire = encodeEnvelope(envelope);
    const { headerB64, ciphertextB64 } = await encryptToPeer(
      identity,
      peerId,
      wire,
    );
    const ttl =
      envelope.t === "text" || envelope.t === "image" || envelope.t === "voice"
        ? envelope.ttl
        : undefined;
    const sent = await trpcClientProxy().messages.send.mutate({
      recipientUserId: peerId,
      header: headerB64,
      ciphertext: ciphertextB64,
      ...(ttl && ttl > 0 ? { expiresInSeconds: ttl } : {}),
    });
    await setChatMessageStatus(localId, "sent", sent.id);
  } catch (err) {
    await setChatMessageStatus(localId, "failed");
    throw err;
  }
  return localId;
}

/**
 * Transmit a side-effect envelope (delete-for-everyone / reaction)
 * through the ratchet without creating a local chat row. Used by the
 * delete/react UI; local state is mutated by the caller.
 */
async function transmitSideEffectEnvelope(
  identity: UnlockedIdentity,
  peerId: string,
  envelope: ChatEnvelope,
): Promise<void> {
  const wire = encodeEnvelope(envelope);
  const { headerB64, ciphertextB64 } = await encryptToPeer(
    identity,
    peerId,
    wire,
  );
  await trpcClientProxy().messages.send.mutate({
    recipientUserId: peerId,
    header: headerB64,
    ciphertext: ciphertextB64,
  });
}

/**
 * "Delete for everyone": tombstone our local row, send a `del`
 * envelope to the peer so their device updates live, and ask the
 * server to wipe the persisted ciphertext so a future history fetch
 * won't restore it.
 *
 * Caller must pass a row that the current user actually sent.
 */
export async function deleteMessageForEveryone(
  identity: UnlockedIdentity,
  peerId: string,
  row: ChatMessageRecord,
): Promise<void> {
  if (!row.serverId) {
    // Never reached the server — just nuke locally.
    if (row.id !== undefined) {
      const { deleteChatMessageById } = await import("./db");
      await deleteChatMessageById(row.id);
    }
    return;
  }
  const env: ChatEnvelope = { v: 2, t: "del", target: row.serverId };
  // Mutate local first so the UI feels instant; if network fails the
  // peer will just not see the unsend. "Unsend" hard-deletes on this
  // device too — no tombstone, no trace in the chat.
  if (row.id !== undefined) {
    const { deleteChatMessageById } = await import("./db");
    await deleteChatMessageById(row.id);
  }
  try {
    await transmitSideEffectEnvelope(identity, peerId, env);
  } catch (e) {
    console.warn("delete-for-everyone envelope failed", e);
  }
  try {
    await trpcClientProxy().messages.deleteForEveryone.mutate({ id: row.serverId });
  } catch (e) {
    console.warn("delete-for-everyone server wipe failed", e);
  }
}

/**
 * Edit a previously-sent text message. Optimistically rewrites the
 * local row's plaintext, then sends an `edit` envelope to the peer.
 *
 * Caller must pass a row that the current user actually sent and that
 * has a server id (i.e. `pending`/`failed` rows can't be edited yet).
 */
export async function editChatMessage(
  identity: UnlockedIdentity,
  peerId: string,
  row: ChatMessageRecord,
  newBody: string,
): Promise<void> {
  if (!row.serverId) {
    throw new Error("Message hasn't been sent yet — can't edit it.");
  }
  if (row.attachment) {
    throw new Error("Only text messages can be edited.");
  }
  const editedAt = new Date().toISOString();
  await applyEditByServerId(row.serverId, newBody, editedAt);
  const env: ChatEnvelope = {
    v: 2,
    t: "edit",
    target: row.serverId,
    body: newBody,
    editedAt,
  };
  try {
    await transmitSideEffectEnvelope(identity, peerId, env);
  } catch (e) {
    console.warn("edit envelope failed", e);
    throw e;
  }
}

/**
 * Send (or clear, if `emoji === ""`) my reaction on a message. Updates
 * the local row optimistically so the bubble shows the reaction
 * instantly; the peer applies it on receive.
 */
export async function sendReaction(
  identity: UnlockedIdentity,
  peerId: string,
  myUserId: string,
  targetServerId: string,
  emoji: string,
): Promise<void> {
  await applyReactionByServerId(targetServerId, myUserId, emoji);
  const env: ChatEnvelope = {
    v: 2,
    t: "rxn",
    target: targetServerId,
    emoji,
  };
  try {
    await transmitSideEffectEnvelope(identity, peerId, env);
  } catch (e) {
    console.warn("reaction envelope failed", e);
  }
}

/* ─────────────────────── Read receipts ─────────────────────── */

/**
 * Mark a batch of inbound messages as read on the server. Caller is
 * responsible for honouring the user's stealth preferences.
 */
export async function reportRead(serverIds: string[]): Promise<void> {
  if (serverIds.length === 0) return;
  if (!getCachedStealthPrefs().readReceiptsEnabled) return;
  if (!wsMarkRead(serverIds)) {
    try {
      await trpcClientProxy().messages.markRead.mutate({ ids: serverIds });
    } catch (e) {
      console.warn("markRead HTTP fallback failed", e);
    }
  }
}

/** Apply an inbound delivery_receipt event to the local outbox. */
export async function applyDeliveryReceipt(
  messageId: string,
  at: string,
): Promise<void> {
  await markChatMessageDelivered(messageId, at);
}

/** Apply an inbound read_receipt event to the local outbox. */
export async function applyReadReceipt(
  messageId: string,
  at: string,
): Promise<void> {
  await markChatMessageRead(messageId, at);
}

/**
 * Catch-up: pull authoritative delivered/read state from the server for
 * any outbound messages that aren't yet "read". Used on focus, network
 * reconnect, WS reopen, and a slow background timer to recover from
 * missed `delivery_receipt` / `read_receipt` WS events.
 */
export async function syncOutboundReceipts(): Promise<void> {
  const pending = await db.chatMessages
    .where("direction")
    .equals("out")
    .and(
      (m) =>
        !!m.serverId &&
        m.status !== "read" &&
        m.status !== "failed" &&
        m.status !== "pending",
    )
    .toArray();
  if (pending.length === 0) return;

  // Cap each call; chunk if needed.
  const ids = pending.map((m) => m.serverId!).slice(0, 500);
  try {
    const { receipts } = await trpcClientProxy().messages.fetchReceipts.query({
      ids,
    });
    for (const r of receipts) {
      if (r.readAt) {
        await markChatMessageRead(r.id, r.readAt);
      } else if (r.deliveredAt) {
        await markChatMessageDelivered(r.id, r.deliveredAt);
      }
    }
  } catch (e) {
    console.warn("syncOutboundReceipts failed", e);
  }
}

/* ─────────────────────── History restore ─────────────────────── */

const HISTORY_PAGE = 100;

/**
 * Load older history for a single peer back from the server. We only
 * persist entries we don't already have locally; ciphertexts we can't
 * decrypt (e.g. older ratchet state from another device) are surfaced
 * as a "[encrypted]" placeholder so the user at least sees the gap.
 */
export async function restorePeerHistory(
  identity: UnlockedIdentity,
  peerId: string,
  myUserId: string,
): Promise<{ loaded: number; pages: number; hasMore: boolean }> {
  let loaded = 0;
  let pages = 0;
  let before = await getEarliestChatMessageTime(peerId);
  let hasMore = true;
  while (hasMore && pages < 5) {
    const page = await trpcClientProxy().messages.fetchHistory.query({
      peerId,
      before: before ?? undefined,
      limit: HISTORY_PAGE,
    });
    pages += 1;
    if (page.messages.length === 0) {
      hasMore = page.hasMore;
      break;
    }
    const ordered = [...page.messages].reverse();
    for (const m of ordered) {
      if (await hasChatMessageWithServerId(m.id)) continue;
      const result = await persistHistoryEntry(identity, m, myUserId);
      if (result) loaded += 1;
    }
    const oldest = ordered[0];
    if (oldest) before = oldest.createdAt;
    hasMore = page.hasMore;
  }
  return { loaded, pages, hasMore };
}

async function persistHistoryEntry(
  identity: UnlockedIdentity,
  m: HistoryMessage,
  myUserId: string,
): Promise<boolean> {
  const isOutbound = m.senderUserId === myUserId;
  const otherPeer = isOutbound ? m.recipientUserId : m.senderUserId;

  if (isOutbound) {
    const status: ChatMessageRecord["status"] = m.readAt
      ? "read"
      : m.deliveredAt
        ? "delivered"
        : "sent";
    await appendChatMessage({
      peerId: otherPeer,
      serverId: m.id,
      direction: "out",
      plaintext: "[sent on another device]",
      createdAt: m.createdAt,
      status,
      ...(m.expiresAt ? { expiresAt: m.expiresAt } : {}),
      ...(m.deliveredAt ? { deliveredAt: m.deliveredAt } : {}),
      ...(m.readAt ? { readAt: m.readAt } : {}),
    });
    return true;
  }

  try {
    const plaintext = await decryptIncoming(identity, {
      id: m.id,
      senderUserId: m.senderUserId,
      header: m.header,
      ciphertext: m.ciphertext,
      createdAt: m.createdAt,
    });
    const env = decodeEnvelope(plaintext);
    await appendChatMessage({
      peerId: otherPeer,
      serverId: m.id,
      direction: "in",
      ...envelopeToRecordFields(env, m.expiresAt),
      createdAt: m.createdAt,
      status: "received",
    });
    return true;
  } catch {
    await appendChatMessage({
      peerId: otherPeer,
      serverId: m.id,
      direction: "in",
      plaintext: "[encrypted — couldn't decrypt on this device]",
      createdAt: m.createdAt,
      status: "received",
    });
    return true;
  }
}

/* ─────────────────────── View-once handling ─────────────────────── */

/**
 * Called once the recipient actually opens a view-once message. Wipes
 * the local row + tries to delete the underlying media blob from R2.
 */
export async function consumeViewOnce(localId: number): Promise<void> {
  const row = await db.chatMessages.get(localId);
  if (!row) return;
  // Wipe the local copy. R2 blobs are reaped server-side by the
  // mediaSweeper on their normal TTL.
  await db.chatMessages.delete(localId);
}
