/**
 * Phase 7 — Group chat orchestrator.
 *
 *  - Lazily creates the local sender key for a group + epoch when we
 *    first need to send.
 *  - Distributes that key to every other group member through the
 *    existing 1:1 ratchet (Sender Key Distribution Message).
 *  - Re-distributes on epoch bumps (membership change).
 *  - Encrypts/decrypts group messages with sender-key chains.
 *  - Persists per-group plaintext log mirror in IndexedDB.
 */

import { trpcClientProxy } from "./trpcClientProxy";
import {
  appendGroupMessage,
  applyGroupEditByServerId,
  applyGroupReactionByServerId,
  deleteExpiredGroupMessages,
  deleteSenderKeysForGroup,
  findGroupMessageByServerId,
  getEarliestGroupMessageTime,
  getSenderKey,
  hasGroupMessageDedup,
  putSenderKey,
  setGroupMessageStatus,
  tombstoneGroupMessageByServerId,
  type GroupMessageRecord,
  type GroupSenderKeyRecord,
} from "./db";
import {
  decodeGroupHeader,
  freshChainKey,
  groupDecrypt,
  groupEncrypt,
  type SenderKeyState,
} from "./signal/group";
import { encryptToPeer } from "./signal/session";
import {
  decodeEnvelope,
  encodeEnvelope,
  type ChatEnvelope,
  type SenderKeyDistribution,
  type SenderKeyRequest,
} from "./messageEnvelope";
import { base64ToBytes, bytesToBase64 } from "./crypto";
import type { UnlockedIdentity } from "./signal/session";
import type { GroupDetail, GroupHistoryMessage, InboxMessage } from "@veil/shared";

function recToState(rec: GroupSenderKeyRecord): SenderKeyState {
  return {
    groupId: rec.groupId,
    senderUserId: rec.senderUserId,
    epoch: rec.epoch,
    chainKey: rec.chainKey,
    n: rec.n,
    skipped: rec.skipped ? JSON.parse(rec.skipped) : {},
    updatedAt: rec.updatedAt,
  };
}

function stateToRec(
  state: SenderKeyState,
  distributedTo?: string,
): GroupSenderKeyRecord {
  return {
    id: `${state.groupId}:${state.senderUserId}:${state.epoch}`,
    groupId: state.groupId,
    senderUserId: state.senderUserId,
    epoch: state.epoch,
    chainKey: state.chainKey,
    n: state.n,
    skipped: JSON.stringify(state.skipped),
    ...(distributedTo !== undefined ? { distributedTo } : {}),
    updatedAt: state.updatedAt,
  };
}

function parseDistributed(rec: GroupSenderKeyRecord | undefined): Set<string> {
  if (!rec?.distributedTo) return new Set();
  try {
    const arr = JSON.parse(rec.distributedTo) as unknown;
    if (Array.isArray(arr)) return new Set(arr.filter((x): x is string => typeof x === "string"));
  } catch {
    /* fall through */
  }
  return new Set();
}

/* ─────────────── Sender Key creation + distribution ─────────────── */

async function loadGroup(groupId: string): Promise<GroupDetail> {
  return await trpcClientProxy().groups.get.query({ groupId });
}

/**
 * Make sure I have a sender-key for this group at the current epoch,
 * and that every *other* member has received it. Idempotent: if the
 * key exists and we believe it was already distributed, we no-op.
 *
 * Strategy: store a marker in the chain key record once distribution
 * completes. We re-distribute whenever the group epoch changes.
 */
export async function ensureMySenderKey(
  identity: UnlockedIdentity,
  group: GroupDetail,
): Promise<SenderKeyState> {
  const me = identity.userId;
  const epoch = group.epoch;
  let rec = await getSenderKey(group.id, me, epoch);
  let state: SenderKeyState;

  if (!rec) {
    // No key for this epoch yet — generate a fresh chain key.
    const chain = freshChainKey();
    state = {
      groupId: group.id,
      senderUserId: me,
      epoch,
      chainKey: bytesToBase64(chain),
      n: 0,
      skipped: {},
      updatedAt: new Date().toISOString(),
    };
    rec = stateToRec(state, "[]");
    await putSenderKey(rec);
  } else {
    state = recToState(rec);
  }

  // Self-healing distribution: figure out which current members haven't
  // yet received our SKDM for this epoch, and (re)deliver to them.
  // Members get added to `distributedTo` once their leg succeeds. This
  // covers: brand-new key, partial failure on first try, members added
  // to the group after we created the key, and stale recipients whose
  // 1:1 SKDM was lost in transit.
  const distributed = parseDistributed(rec);
  const targets = group.members
    .filter((m) => m.userId !== me && !distributed.has(m.userId))
    .map((m) => m.userId);
  if (targets.length > 0) {
    const ok = await distributeSenderKey(identity, group, state, targets);
    for (const uid of ok) distributed.add(uid);
    rec.distributedTo = JSON.stringify(Array.from(distributed));
    await putSenderKey(rec);
  }

  return state;
}

/**
 * Re-fetch the group and re-distribute my sender key to current members.
 * Used after a `group_changed` WS event or before sending if epoch bumped.
 */
export async function rotateMySenderKeyIfNeeded(
  identity: UnlockedIdentity,
  groupId: string,
): Promise<void> {
  const group = await loadGroup(groupId);
  await ensureMySenderKey(identity, group);
}

async function distributeSenderKey(
  identity: UnlockedIdentity,
  group: GroupDetail,
  state: SenderKeyState,
  recipients?: string[],
): Promise<string[]> {
  const skdm: SenderKeyDistribution = {
    v: 2,
    t: "skdm",
    gid: group.id,
    ep: state.epoch,
    ck: state.chainKey,
  };
  const wire = encodeEnvelope(skdm);
  const me = identity.userId;
  const targets =
    recipients ?? group.members.filter((m) => m.userId !== me).map((m) => m.userId);
  const results = await Promise.all(
    targets.map(async (uid): Promise<string | null> => {
      try {
        const { headerB64, ciphertextB64 } = await encryptToPeer(
          identity,
          uid,
          wire,
        );
        await trpcClientProxy().messages.send.mutate({
          recipientUserId: uid,
          header: headerB64,
          ciphertext: ciphertextB64,
        });
        return uid;
      } catch (e) {
        console.warn(`Failed to deliver SKDM for ${group.id} to ${uid}:`, e);
        return null;
      }
    }),
  );
  return results.filter((u): u is string => u !== null);
}

/**
 * Returns the user-ids of `currentMembers` who have NOT yet acknowledged
 * our sender key for (groupId, epoch). Used by the group composer to
 * surface "X members can't yet read your messages" while distribution
 * is still in progress. Excludes ourselves. If we don't have a sender
 * key for this epoch yet, every other member is considered pending.
 */
export async function getPendingSenderKeyRecipients(
  groupId: string,
  me: string,
  epoch: number,
  currentMemberIds: string[],
): Promise<string[]> {
  const others = currentMemberIds.filter((u) => u !== me);
  const rec = await getSenderKey(groupId, me, epoch);
  if (!rec) return others;
  const distributed = parseDistributed(rec);
  return others.filter((u) => !distributed.has(u));
}

/* ─────────────── Sender Key REQUEST (recovery path) ─────────────── */

/**
 * Throttle outbound `skreq` messages so a single un-decryptable group
 * post (which the user may see redelivered on every reconnect) doesn't
 * spam the original sender with hundreds of identical requests.
 */
const _skreqThrottle = new Map<string, number>();
const SKREQ_COOLDOWN_MS = 30_000;

/**
 * Ask `senderUserId` to redistribute their sender key for
 * (groupId, epoch) by sending them a 1:1 `skreq` envelope. No-op if we
 * already requested the same triple in the last 30 seconds.
 */
export async function requestSenderKey(
  identity: UnlockedIdentity,
  groupId: string,
  epoch: number,
  senderUserId: string,
): Promise<void> {
  if (senderUserId === identity.userId) return;
  const key = `${groupId}:${senderUserId}:${epoch}`;
  const last = _skreqThrottle.get(key) ?? 0;
  const now = Date.now();
  if (now - last < SKREQ_COOLDOWN_MS) return;
  _skreqThrottle.set(key, now);
  const env: SenderKeyRequest = { v: 2, t: "skreq", gid: groupId, ep: epoch };
  try {
    const { headerB64, ciphertextB64 } = await encryptToPeer(
      identity,
      senderUserId,
      encodeEnvelope(env),
    );
    await trpcClientProxy().messages.send.mutate({
      recipientUserId: senderUserId,
      header: headerB64,
      ciphertext: ciphertextB64,
    });
  } catch (e) {
    console.warn(
      `Failed to request sender key from ${senderUserId} for ${groupId}/${epoch}:`,
      e,
    );
    // Allow a retry sooner if the request itself failed.
    _skreqThrottle.delete(key);
  }
}

/**
 * Inbound `skreq` from a peer who can't decrypt one of our group
 * messages. Look up our sender key for the requested (group, epoch);
 * if we have one, fan a fresh SKDM back to just that requester (and
 * mark them as distributed-to so we don't re-send unnecessarily).
 */
export async function handleIncomingSenderKeyRequest(
  identity: UnlockedIdentity,
  fromUserId: string,
  req: SenderKeyRequest,
): Promise<void> {
  const me = identity.userId;
  const rec = await getSenderKey(req.gid, me, req.ep);
  if (!rec) {
    // We don't have a sender key for that epoch — nothing to share.
    // (Likely the requester is on a stale epoch; they'll catch up via
    // group_changed → ensureMySenderKey on our side for the new epoch.)
    return;
  }
  const state = recToState(rec);
  let group: GroupDetail;
  try {
    group = await loadGroup(req.gid);
  } catch {
    return;
  }
  // Only honour requests from current group members.
  if (!group.members.some((m) => m.userId === fromUserId)) return;
  const ok = await distributeSenderKey(identity, group, state, [fromUserId]);
  if (ok.length > 0) {
    const distributed = parseDistributed(rec);
    distributed.add(fromUserId);
    rec.distributedTo = JSON.stringify(Array.from(distributed));
    await putSenderKey(rec);
  }
}

/* ─────────────── Inbound 1:1 SKDM handler ─────────────── */

/**
 * Called from messageSync when an inbound 1:1 plaintext is detected to
 * be a Sender Key Distribution Message. Stores the chain key under
 * (gid, sender, ep) so we can decrypt subsequent group messages from
 * that sender.
 */
export async function handleIncomingSenderKey(
  senderUserId: string,
  skdm: SenderKeyDistribution,
): Promise<void> {
  const existing = await getSenderKey(skdm.gid, senderUserId, skdm.ep);
  if (existing) {
    // Re-installation: skip — keeping our advanced state is safer.
    return;
  }
  const rec: GroupSenderKeyRecord = {
    id: `${skdm.gid}:${senderUserId}:${skdm.ep}`,
    groupId: skdm.gid,
    senderUserId,
    epoch: skdm.ep,
    chainKey: skdm.ck,
    n: 0,
    skipped: "{}",
    updatedAt: new Date().toISOString(),
  };
  await putSenderKey(rec);
}

/* ─────────────── Send group message ─────────────── */

export async function sendGroupChat(
  identity: UnlockedIdentity,
  groupId: string,
  envelope: ChatEnvelope,
): Promise<number> {
  const group = await loadGroup(groupId);
  const state = await ensureMySenderKey(identity, group);

  const dedupKey = `${identity.userId}:${state.epoch}:${state.n}`;
  const hasTtl =
    (envelope.t === "text" || envelope.t === "image" || envelope.t === "voice") &&
    !!envelope.ttl;
  // Resolve replyTo into a stored sub-doc (denormalised for the UI).
  let replyTo: GroupMessageRecord["replyTo"] | undefined;
  if (
    (envelope.t === "text" || envelope.t === "image" || envelope.t === "voice") &&
    envelope.re
  ) {
    const orig = await findGroupMessageByServerId(envelope.re.id);
    replyTo = {
      serverId: envelope.re.id,
      body: envelope.re.body,
      senderUserId: orig?.senderUserId ?? "",
    };
  }
  const localId = await appendGroupMessage({
    groupId,
    serverId: null,
    dedupKey,
    senderUserId: identity.userId,
    direction: "out",
    plaintext: envelope.t === "text" ? envelope.body : "",
    createdAt: new Date().toISOString(),
    status: "pending",
    expiresAt: hasTtl
      ? new Date(Date.now() + (envelope as { ttl: number }).ttl * 1000).toISOString()
      : undefined,
    attachment:
      envelope.t === "image" || envelope.t === "voice"
        ? { ...envelope.media, kind: envelope.t }
        : undefined,
    linkPreview:
      (envelope.t === "text" || envelope.t === "image" || envelope.t === "voice") &&
      envelope.lp
        ? envelope.lp
        : undefined,
    pollData:
      envelope.t === "poll"
        ? { pollId: envelope.pollId, question: envelope.question, choices: envelope.choices }
        : undefined,
    pollVoteData:
      envelope.t === "poll_vote"
        ? { pollId: envelope.pollId, choiceIdx: envelope.choiceIdx }
        : undefined,
    ...(replyTo ? { replyTo } : {}),
  } as Omit<GroupMessageRecord, "id">);

  try {
    const wire = new TextEncoder().encode(encodeEnvelope(envelope));
    // Fan-out cipher: each recipient gets the same header + ciphertext.
    const { headerB64, ciphertextB64 } = await groupEncrypt(state, wire);
    await putSenderKey(stateToRec(state));
    const recipients = group.members
      .filter((m) => m.userId !== identity.userId)
      .map((m) => ({
        recipientUserId: m.userId,
        header: headerB64,
        ciphertext: ciphertextB64,
      }));
    if (recipients.length === 0) {
      // Group of one — local-only, mark as sent.
      await setGroupMessageStatus(localId, "sent");
      return localId;
    }
    const sent = await trpcClientProxy().messages.sendGroup.mutate({
      groupId,
      recipients,
      ...((envelope.t === "text" ||
        envelope.t === "image" ||
        envelope.t === "voice") &&
      envelope.ttl
        ? { expiresInSeconds: envelope.ttl }
        : {}),
    });
    await setGroupMessageStatus(localId, "sent", sent.ids[0]);
  } catch (err) {
    await setGroupMessageStatus(localId, "failed");
    throw err;
  }
  return localId;
}

export async function sendGroupText(
  identity: UnlockedIdentity,
  groupId: string,
  text: string,
  opts: { ttlSeconds?: number } = {},
): Promise<number> {
  const env: ChatEnvelope = { v: 2, t: "text", body: text };
  if (opts.ttlSeconds && opts.ttlSeconds > 0) env.ttl = opts.ttlSeconds;
  return sendGroupChat(identity, groupId, env);
}

export async function sendGroupPoll(
  identity: UnlockedIdentity,
  groupId: string,
  pollId: string,
  question: string,
  choices: string[],
): Promise<number> {
  const env: ChatEnvelope = { v: 2, t: "poll", pollId, question, choices };
  return sendGroupChat(identity, groupId, env);
}

export async function sendGroupPollVote(
  identity: UnlockedIdentity,
  groupId: string,
  pollId: string,
  choiceIdx: number,
): Promise<number> {
  const env: ChatEnvelope = { v: 2, t: "poll_vote", pollId, choiceIdx };
  return sendGroupChat(identity, groupId, env);
}

/**
 * Send (or clear) the current user's reaction on a group message.
 * Optimistically updates the local row, then fans out an `rxn`
 * envelope through the sender-key channel.
 */
export async function sendGroupReaction(
  identity: UnlockedIdentity,
  groupId: string,
  targetServerId: string,
  emoji: string,
): Promise<void> {
  await applyGroupReactionByServerId(targetServerId, identity.userId, emoji);
  const env: ChatEnvelope = { v: 2, t: "rxn", target: targetServerId, emoji };
  try {
    await broadcastSideEffectEnvelope(identity, groupId, env);
  } catch (e) {
    console.warn("group reaction envelope failed", e);
  }
}

/**
 * Edit a previously-sent text message in a group. Optimistically
 * rewrites the local row, then broadcasts the new body to every member.
 */
export async function sendGroupEdit(
  identity: UnlockedIdentity,
  groupId: string,
  row: GroupMessageRecord,
  newBody: string,
): Promise<void> {
  if (!row.serverId) {
    throw new Error("Message hasn't been sent yet — can't edit it.");
  }
  if (row.attachment) {
    throw new Error("Only text messages can be edited.");
  }
  if (row.senderUserId !== identity.userId) {
    throw new Error("You can only edit your own messages.");
  }
  const editedAt = new Date().toISOString();
  await applyGroupEditByServerId(row.serverId, newBody, editedAt);
  const env: ChatEnvelope = {
    v: 2,
    t: "edit",
    target: row.serverId,
    body: newBody,
    editedAt,
  };
  try {
    await broadcastSideEffectEnvelope(identity, groupId, env);
  } catch (e) {
    console.warn("group edit envelope failed", e);
    throw e;
  }
}

/**
 * "Unsend for everyone" in a group. Tombstones the local row, fans out
 * a `del` envelope, and asks the server to wipe the persisted ciphertext
 * legs so a fresh device's history fetch can't restore the body.
 */
export async function sendGroupDeleteForEveryone(
  identity: UnlockedIdentity,
  groupId: string,
  row: GroupMessageRecord,
): Promise<void> {
  if (!row.serverId) {
    // Never reached the server — local hard-delete is enough.
    if (row.id !== undefined) {
      const { deleteGroupMessageById } = await import("./db");
      await deleteGroupMessageById(row.id);
    }
    return;
  }
  await tombstoneGroupMessageByServerId(row.serverId);
  const env: ChatEnvelope = { v: 2, t: "del", target: row.serverId };
  try {
    await broadcastSideEffectEnvelope(identity, groupId, env);
  } catch (e) {
    console.warn("group delete envelope failed", e);
  }
  try {
    await trpcClientProxy().messages.deleteForEveryone.mutate({
      id: row.serverId,
    });
  } catch (e) {
    console.warn("group delete server wipe failed", e);
  }
}

/**
 * Encrypt a side-effect envelope (rxn / edit / del) under the current
 * sender key and fan it out to every other group member. Does NOT
 * persist a local row — the caller already mutated local state.
 */
async function broadcastSideEffectEnvelope(
  identity: UnlockedIdentity,
  groupId: string,
  envelope: ChatEnvelope,
): Promise<void> {
  const group = await loadGroup(groupId);
  const state = await ensureMySenderKey(identity, group);
  const wire = new TextEncoder().encode(encodeEnvelope(envelope));
  const { headerB64, ciphertextB64 } = await groupEncrypt(state, wire);
  await putSenderKey(stateToRec(state));
  const recipients = group.members
    .filter((m) => m.userId !== identity.userId)
    .map((m) => ({
      recipientUserId: m.userId,
      header: headerB64,
      ciphertext: ciphertextB64,
    }));
  if (recipients.length === 0) return;
  await trpcClientProxy().messages.sendGroup.mutate({ groupId, recipients });
}

/* ─────────────── Inbound group message ─────────────── */

/**
 * Called from messageSync when an InboxMessage carries a `groupId` (the
 * server flagged this row as a fan-out leg). Decrypts via the sender
 * key we received earlier. Returns true if a new message was stored.
 */
export async function ingestGroupInboxMessage(
  m: InboxMessage,
  identity?: UnlockedIdentity,
): Promise<"new" | "duplicate" | "failed"> {
  if (!m.groupId) return "failed";
  let header: ReturnType<typeof decodeGroupHeader>;
  try {
    header = decodeGroupHeader(m.header);
  } catch {
    return "failed";
  }
  const dedupKey = `${header.header.sender}:${header.header.ep}:${header.header.n}`;
  if (await hasGroupMessageDedup(dedupKey)) return "duplicate";

  const rec = await getSenderKey(
    header.header.gid,
    header.header.sender,
    header.header.ep,
  );
  if (!rec) {
    console.warn(
      `Group message arrived for ${header.header.gid} from ${header.header.sender} epoch ${header.header.ep}, but no sender key yet (will rely on SKDM).`,
    );
    // WhatsApp-style recovery: ask the sender to redistribute their
    // sender key to us via 1:1 ratchet. Throttled so we don't spam.
    if (identity) {
      void requestSenderKey(
        identity,
        header.header.gid,
        header.header.ep,
        header.header.sender,
      ).catch(() => undefined);
    }
    return "failed";
  }
  const state = recToState(rec);
  const ct = base64ToBytes(m.ciphertext);
  const ptBytes = await groupDecrypt(state, header.bytes, header.header, ct);
  await putSenderKey(stateToRec(state));
  if (!ptBytes) return "failed";

  const ptText = new TextDecoder().decode(ptBytes);
  const env = decodeEnvelope(ptText);

  // Poll definition envelope.
  if (env.t === "poll") {
    await appendGroupMessage({
      groupId: m.groupId,
      serverId: m.id,
      dedupKey,
      senderUserId: header.header.sender,
      direction: "in",
      plaintext: "",
      createdAt: m.createdAt,
      status: "received",
      pollData: {
        pollId: env.pollId,
        question: env.question,
        choices: env.choices,
      },
    });
    return "new";
  }

  // Poll vote envelope.
  if (env.t === "poll_vote") {
    await appendGroupMessage({
      groupId: m.groupId,
      serverId: m.id,
      dedupKey,
      senderUserId: header.header.sender,
      direction: "in",
      plaintext: "",
      createdAt: m.createdAt,
      status: "received",
      pollVoteData: {
        pollId: env.pollId,
        choiceIdx: env.choiceIdx,
      },
    });
    return "new";
  }

  // Side-effect envelopes mutate an existing row instead of creating one.
  if (env.t === "del") {
    await tombstoneGroupMessageByServerId(env.target);
    return "new";
  }
  if (env.t === "rxn") {
    await applyGroupReactionByServerId(
      env.target,
      header.header.sender,
      env.emoji,
    );
    return "new";
  }
  if (env.t === "edit") {
    await applyGroupEditByServerId(env.target, env.body, env.editedAt);
    return "new";
  }

  // Anything else that isn't text / image / voice has no row to render.
  if (env.t !== "text" && env.t !== "image" && env.t !== "voice") {
    return "duplicate";
  }

  // Extract @mention tokens (format: @<8-char-fingerprint>)
  const mentionPattern = /@([a-f0-9]{8})/gi;
  const mentions: string[] = [];
  let mm: RegExpExecArray | null;
  while ((mm = mentionPattern.exec(env.t === "text" ? env.body : "")) !== null) {
    const token = mm[1];
    if (token !== undefined && !mentions.includes(token)) mentions.push(token);
  }

  // Resolve replyTo (re) into a stored sub-doc.
  let replyTo: GroupMessageRecord["replyTo"] | undefined;
  if (env.re) {
    const orig = await findGroupMessageByServerId(env.re.id);
    replyTo = {
      serverId: env.re.id,
      body: env.re.body,
      senderUserId: orig?.senderUserId ?? "",
    };
  }

  await appendGroupMessage({
    groupId: m.groupId,
    serverId: m.id,
    dedupKey,
    senderUserId: header.header.sender,
    direction: "in",
    plaintext: env.t === "text" ? env.body : "",
    createdAt: m.createdAt,
    status: "received",
    expiresAt: m.expiresAt ?? undefined,
    attachment:
      env.t === "image" || env.t === "voice"
        ? { ...env.media, kind: env.t }
        : undefined,
    linkPreview: env.lp,
    ...(mentions.length > 0 ? { mentions } : {}),
    ...(replyTo ? { replyTo } : {}),
  });
  return "new";
}

/* ─────────────── Reset on group leave/delete ─────────────── */

export async function resetLocalGroup(groupId: string): Promise<void> {
  await deleteSenderKeysForGroup(groupId);
  // Keep the message log so the user can still see history; users can
  // wipe device for a hard reset.
}

export async function reapExpiredGroupMessages(): Promise<void> {
  await deleteExpiredGroupMessages().catch(() => undefined);
}

/* ─────────────── Group history restore (fresh device / new member) ─────────── */

const GROUP_HISTORY_PAGE = 100;
const GROUP_HISTORY_MAX_PAGES = 5;

/**
 * Load server-side group history for one group and persist it locally.
 * Called once per group on the first unlock of a session (same pattern as
 * `restorePeerHistory` for 1:1 chats).
 *
 * - Outbound messages (sent by me) are stored as "sent on another device"
 *   since we don't have the plaintext on this device.
 * - Inbound messages are decrypted with the stored sender key if available;
 *   otherwise a "[encrypted — couldn't decrypt on this device]" placeholder
 *   is shown so the user can at least see the gap in history.
 */
export async function restoreGroupHistory(
  identity: UnlockedIdentity,
  groupId: string,
): Promise<{ loaded: number; pages: number; hasMore: boolean }> {
  let loaded = 0;
  let pages = 0;
  let before = await getEarliestGroupMessageTime(groupId);
  let hasMore = true;

  while (hasMore && pages < GROUP_HISTORY_MAX_PAGES) {
    const page = await trpcClientProxy().messages.fetchGroupHistory.query({
      groupId,
      before: before ?? undefined,
      limit: GROUP_HISTORY_PAGE,
    });
    pages += 1;

    if (page.messages.length === 0) {
      hasMore = page.hasMore;
      break;
    }

    // Server returns newest-first; process oldest-first so earlier messages
    // are stored before later ones (matters for reply-to resolution).
    const ordered = [...page.messages].reverse();
    for (const m of ordered) {
      const stored = await persistGroupHistoryEntry(identity, groupId, m);
      if (stored) loaded += 1;
    }

    const oldest = ordered[0];
    if (oldest) before = oldest.createdAt;
    hasMore = page.hasMore;
  }

  return { loaded, pages, hasMore };
}

/**
 * Persist a single `GroupHistoryMessage` row into the local IndexedDB store.
 * Returns true if a new row was written, false if it was a duplicate.
 */
async function persistGroupHistoryEntry(
  identity: UnlockedIdentity,
  groupId: string,
  m: GroupHistoryMessage,
): Promise<boolean> {
  // Fast dedup by server id: if we already have this row, skip it.
  const existing = await findGroupMessageByServerId(m.id);
  if (existing) return false;

  const isOutbound = m.senderUserId === identity.userId;

  // ── Outbound message (I sent it on another device) ──────────────────
  if (isOutbound) {
    let dedupKey: string;
    try {
      const h = decodeGroupHeader(m.header);
      dedupKey = `${h.header.sender}:${h.header.ep}:${h.header.n}`;
    } catch {
      // Malformed header — use a fallback that won't collide.
      dedupKey = `${m.senderUserId}:hist:${m.id}`;
    }
    if (await hasGroupMessageDedup(dedupKey)) return false;
    await appendGroupMessage({
      groupId,
      serverId: m.id,
      dedupKey,
      senderUserId: m.senderUserId,
      direction: "out",
      plaintext: "[sent from another device]",
      createdAt: m.createdAt,
      status: "sent",
      ...(m.expiresAt ? { expiresAt: m.expiresAt } : {}),
    } as Omit<GroupMessageRecord, "id">);
    return true;
  }

  // ── Inbound message ─────────────────────────────────────────────────
  let header: ReturnType<typeof decodeGroupHeader>;
  try {
    header = decodeGroupHeader(m.header);
  } catch {
    // Can't even parse the header — nothing we can do.
    return false;
  }

  const dedupKey = `${header.header.sender}:${header.header.ep}:${header.header.n}`;
  if (await hasGroupMessageDedup(dedupKey)) return false;

  // Helper: store a placeholder when we can't decrypt.
  const storePlaceholder = async () => {
    await appendGroupMessage({
      groupId,
      serverId: m.id,
      dedupKey,
      senderUserId: m.senderUserId,
      direction: "in",
      plaintext: "[encrypted — couldn't decrypt on this device]",
      createdAt: m.createdAt,
      status: "received",
      ...(m.expiresAt ? { expiresAt: m.expiresAt } : {}),
    } as Omit<GroupMessageRecord, "id">);
  };

  const rec = await getSenderKey(
    header.header.gid,
    header.header.sender,
    header.header.ep,
  );

  if (!rec) {
    // We don't have the sender key for this epoch — show a placeholder.
    await storePlaceholder();
    return true;
  }

  // Try to decrypt with the stored sender key.
  const state = recToState(rec);
  const ct = base64ToBytes(m.ciphertext);
  let ptBytes: Uint8Array | null = null;
  try {
    ptBytes = await groupDecrypt(state, header.bytes, header.header, ct);
    await putSenderKey(stateToRec(state));
  } catch {
    await storePlaceholder();
    return true;
  }

  if (!ptBytes) {
    await storePlaceholder();
    return true;
  }

  const ptText = new TextDecoder().decode(ptBytes);
  let env: ReturnType<typeof decodeEnvelope>;
  try {
    env = decodeEnvelope(ptText);
  } catch {
    await storePlaceholder();
    return true;
  }

  // Side-effect envelopes (reactions, edits, deletes) don't create rows —
  // they mutate existing ones. We skip them here; they will be applied
  // when the live inbox processes any newer occurrences.
  if (env.t === "del" || env.t === "rxn" || env.t === "edit" || env.t === "skdm") {
    return false;
  }

  // Resolve reply reference if present.
  let replyTo: GroupMessageRecord["replyTo"] | undefined;
  if (
    (env.t === "text" || env.t === "image" || env.t === "voice") &&
    env.re
  ) {
    const orig = await findGroupMessageByServerId(env.re.id);
    replyTo = {
      serverId: env.re.id,
      body: env.re.body,
      senderUserId: orig?.senderUserId ?? "",
    };
  }

  await appendGroupMessage({
    groupId,
    serverId: m.id,
    dedupKey,
    senderUserId: m.senderUserId,
    direction: "in",
    plaintext:
      env.t === "text"
        ? env.body
        : env.t === "image"
          ? (env.body ?? "")
          : "",
    createdAt: m.createdAt,
    status: "received",
    ...(m.expiresAt ? { expiresAt: m.expiresAt } : {}),
    ...(env.t === "image" || env.t === "voice"
      ? { attachment: { ...env.media, kind: env.t } }
      : {}),
    ...(env.t === "poll"
      ? {
          pollData: {
            pollId: env.pollId,
            question: env.question,
            choices: env.choices,
          },
        }
      : {}),
    ...(env.t === "poll_vote"
      ? { pollVoteData: { pollId: env.pollId, choiceIdx: env.choiceIdx } }
      : {}),
    ...(replyTo ? { replyTo } : {}),
  } as Omit<GroupMessageRecord, "id">);
  return true;
}
