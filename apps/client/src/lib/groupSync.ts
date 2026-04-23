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
  deleteExpiredGroupMessages,
  deleteSenderKeysForGroup,
  getSenderKey,
  hasGroupMessageDedup,
  putSenderKey,
  setGroupMessageStatus,
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
} from "./messageEnvelope";
import { base64ToBytes, bytesToBase64 } from "./crypto";
import type { UnlockedIdentity } from "./signal/session";
import type { GroupDetail, InboxMessage } from "@veil/shared";

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

function stateToRec(state: SenderKeyState): GroupSenderKeyRecord {
  return {
    id: `${state.groupId}:${state.senderUserId}:${state.epoch}`,
    groupId: state.groupId,
    senderUserId: state.senderUserId,
    epoch: state.epoch,
    chainKey: state.chainKey,
    n: state.n,
    skipped: JSON.stringify(state.skipped),
    updatedAt: state.updatedAt,
  };
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
  const existing = await getSenderKey(group.id, me, epoch);
  if (existing) return recToState(existing);

  // Generate fresh chain key.
  const chain = freshChainKey();
  const state: SenderKeyState = {
    groupId: group.id,
    senderUserId: me,
    epoch,
    chainKey: bytesToBase64(chain),
    n: 0,
    skipped: {},
    updatedAt: new Date().toISOString(),
  };
  await putSenderKey(stateToRec(state));

  // Distribute to every other member through their 1:1 ratchet.
  await distributeSenderKey(identity, group, state);
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
): Promise<void> {
  const skdm: SenderKeyDistribution = {
    v: 2,
    t: "skdm",
    gid: group.id,
    ep: state.epoch,
    ck: state.chainKey,
  };
  const wire = encodeEnvelope(skdm);
  const me = identity.userId;
  await Promise.all(
    group.members
      .filter((m) => m.userId !== me)
      .map(async (m) => {
        try {
          const { headerB64, ciphertextB64 } = await encryptToPeer(
            identity,
            m.userId,
            wire,
          );
          await trpcClientProxy().messages.send.mutate({
            recipientUserId: m.userId,
            header: headerB64,
            ciphertext: ciphertextB64,
          });
        } catch (e) {
          console.warn(
            `Failed to deliver SKDM for ${group.id} to ${m.userId}:`,
            e,
          );
        }
      }),
  );
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
  const localId = await appendGroupMessage({
    groupId,
    serverId: null,
    dedupKey,
    senderUserId: identity.userId,
    direction: "out",
    plaintext: envelope.t === "text" ? envelope.body : "",
    createdAt: new Date().toISOString(),
    status: "pending",
    expiresAt:
      (envelope.t === "text" || envelope.t === "image" || envelope.t === "voice") &&
      envelope.ttl
        ? new Date(Date.now() + envelope.ttl * 1000).toISOString()
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

/* ─────────────── Inbound group message ─────────────── */

/**
 * Called from messageSync when an InboxMessage carries a `groupId` (the
 * server flagged this row as a fan-out leg). Decrypts via the sender
 * key we received earlier. Returns true if a new message was stored.
 */
export async function ingestGroupInboxMessage(
  m: InboxMessage,
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
    return "failed";
  }
  const state = recToState(rec);
  const ct = base64ToBytes(m.ciphertext);
  const ptBytes = await groupDecrypt(state, header.bytes, header.header, ct);
  await putSenderKey(stateToRec(state));
  if (!ptBytes) return "failed";

  const ptText = new TextDecoder().decode(ptBytes);
  const env = decodeEnvelope(ptText);
  // Side-effect / control envelopes don't ride group fan-out today.
  if (env.t !== "text" && env.t !== "image" && env.t !== "voice") {
    return "duplicate";
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
