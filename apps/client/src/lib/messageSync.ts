import { trpcClientProxy } from "./trpcClientProxy";
import {
  appendChatMessage,
  consumeOneTimePrekey,
  getOneTimePrekey,
  getSignedPrekey,
  setChatMessageStatus,
  hasChatMessageWithServerId,
  getEarliestChatMessageTime,
  markChatMessageRead,
  deleteExpiredChatMessages,
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

function envelopeToRecordFields(
  env: ChatEnvelope,
  serverExpiresAt?: string | null,
): Pick<ChatMessageRecord, "plaintext" | "attachment" | "viewOnce" | "linkPreview" | "expiresAt"> {
  const expiresAt = serverExpiresAt ?? deriveExpiry(env);
  const extras: Pick<ChatMessageRecord, "viewOnce" | "linkPreview" | "expiresAt"> = {};
  if (env.vo) extras.viewOnce = true;
  if (env.lp) extras.linkPreview = env.lp;
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
  // voice
  return {
    plaintext: "",
    attachment: { ...env.media, kind: "voice" },
    ...extras,
  };
}

function deriveExpiry(env: ChatEnvelope): string | undefined {
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

/**
 * Persist a single live (WS) inbox message and ack delivery to the server.
 * Idempotent: drops messages we've already stored.
 */
export async function ingestInboxMessage(
  identity: UnlockedIdentity,
  m: InboxMessage,
): Promise<"new" | "duplicate" | "failed"> {
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
    await appendChatMessage({
      peerId: m.senderUserId,
      serverId: m.id,
      direction: "in",
      ...envelopeToRecordFields(env, m.expiresAt),
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

  for (const m of messages) {
    if (await hasChatMessageWithServerId(m.id)) {
      acked.push(m.id);
      continue;
    }
    try {
      const plaintext = await decryptIncoming(identity, m);
      const env = decodeEnvelope(plaintext);
      await appendChatMessage({
        peerId: m.senderUserId,
        serverId: m.id,
        direction: "in",
        ...envelopeToRecordFields(env, m.expiresAt),
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
  opts: { ttlSeconds?: number; linkPreview?: ChatEnvelope["lp"] } = {},
): Promise<number> {
  const env: ChatEnvelope = { v: 2, t: "text", body: plaintext };
  if (opts.ttlSeconds && opts.ttlSeconds > 0) env.ttl = opts.ttlSeconds;
  if (opts.linkPreview) env.lp = opts.linkPreview;
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
  if (envelope.ttl || envelope.vo || envelope.lp) envelope.v = 2;
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
    const sent = await trpcClientProxy().messages.send.mutate({
      recipientUserId: peerId,
      header: headerB64,
      ciphertext: ciphertextB64,
      ...(envelope.ttl && envelope.ttl > 0 ? { expiresInSeconds: envelope.ttl } : {}),
    });
    await setChatMessageStatus(localId, "sent", sent.id);
  } catch (err) {
    await setChatMessageStatus(localId, "failed");
    throw err;
  }
  return localId;
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

/** Apply an inbound read_receipt event to the local outbox. */
export async function applyReadReceipt(
  messageId: string,
  at: string,
): Promise<void> {
  await markChatMessageRead(messageId, at);
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
    await appendChatMessage({
      peerId: otherPeer,
      serverId: m.id,
      direction: "out",
      plaintext: "[sent on another device]",
      createdAt: m.createdAt,
      status: "sent",
      ...(m.expiresAt ? { expiresAt: m.expiresAt } : {}),
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
