import { trpcClientProxy } from "./trpcClientProxy";
import {
  appendChatMessage,
  consumeOneTimePrekey,
  getOneTimePrekey,
  getSignedPrekey,
} from "./db";
import { decryptFromPeer, encryptToPeer } from "./signal/session";
import { base64ToBytes } from "./crypto";
import type { UnlockedIdentity } from "./signal/session";

/**
 * Fetch all pending messages from the server, decrypt each one, and
 * append it to the local chat log. Server deletes them as part of the
 * `fetchAndConsume` mutation, so this should only be called when the
 * client has the keys (i.e. unlocked) and is ready to persist results.
 */
export async function pollAndDecrypt(
  identity: UnlockedIdentity,
): Promise<{ added: number; failed: number }> {
  const { messages } = await trpcClientProxy().messages.fetchAndConsume.mutate();
  let added = 0;
  let failed = 0;

  for (const m of messages) {
    try {
      const plaintext = await decryptFromPeer(
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
      await appendChatMessage({
        peerId: m.senderUserId,
        serverId: m.id,
        direction: "in",
        plaintext,
        createdAt: m.createdAt,
        status: "received",
      });
      added += 1;
    } catch (err) {
      console.error("Failed to decrypt message", m.id, err);
      failed += 1;
    }
  }
  return { added, failed };
}

/** Encrypt + send a single outbound message. Returns the local message id. */
export async function sendChatMessage(
  identity: UnlockedIdentity,
  peerId: string,
  plaintext: string,
): Promise<number> {
  const localId = await appendChatMessage({
    peerId,
    serverId: null,
    direction: "out",
    plaintext,
    createdAt: new Date().toISOString(),
    status: "pending",
  });

  const { headerB64, ciphertextB64 } = await encryptToPeer(
    identity,
    peerId,
    plaintext,
  );
  const sent = await trpcClientProxy().messages.send.mutate({
    recipientUserId: peerId,
    header: headerB64,
    ciphertext: ciphertextB64,
  });

  // Update the local row to mark it sent.
  const { setChatMessageStatus } = await import("./db");
  await setChatMessageStatus(localId, "sent", sent.id);
  return localId;
}
