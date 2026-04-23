import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import {
  SendMessageInput,
  SendMessageResult,
  FetchInboxResult,
  MarkDeliveredInput,
  MarkReadInput,
  FetchHistoryInput,
  FetchHistoryResult,
  FetchReceiptsInput,
  FetchReceiptsResult,
  DeleteForEveryoneInput,
  OkSchema,
  SendGroupMessageInput,
  SendGroupMessageResult,
  FetchGroupHistoryInput,
  FetchGroupHistoryResult,
  type InboxMessage,
  type HistoryMessage,
  type MessageReceipt,
  type GroupHistoryMessage,
} from "@veil/shared";
import { protectedProcedure, router } from "../init.js";
import { getDb, schema } from "../../db/index.js";
import { publish } from "../../lib/wsHub.js";
import { pushToUser } from "../../lib/push.js";
import { isBlockedEitherWay } from "./privacy.js";

const MAX_FETCH = 200;

function conversationIdFor(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function bufToB64(b: Buffer | Uint8Array): string {
  return Buffer.from(b).toString("base64");
}

export const messagesRouter = router({
  /** Send an opaque ciphertext + header to a connected peer. */
  send: protectedProcedure
    .input(SendMessageInput)
    .output(SendMessageResult)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const me = ctx.userId;
      const peer = input.recipientUserId;
      if (peer === me) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You can't send a message to yourself.",
        });
      }
      const [a, b] = me < peer ? [me, peer] : [peer, me];
      const conn = await db
        .select({ id: schema.connections.id })
        .from(schema.connections)
        .where(
          and(
            eq(schema.connections.userAId, a),
            eq(schema.connections.userBId, b),
          ),
        )
        .limit(1);
      if (conn.length === 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only message people you're connected with.",
        });
      }

      if (await isBlockedEitherWay(me, peer)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Messages can't be sent in this conversation.",
        });
      }

      const headerBuf = Buffer.from(input.header, "base64");
      const ctBuf = Buffer.from(input.ciphertext, "base64");
      const expiresAt = input.expiresInSeconds
        ? new Date(Date.now() + input.expiresInSeconds * 1000)
        : null;
      const inserted = await db
        .insert(schema.messages)
        .values({
          senderUserId: me,
          recipientUserId: peer,
          conversationId: conversationIdFor(me, peer),
          header: headerBuf,
          ciphertext: ctBuf,
          expiresAt,
        })
        .returning({
          id: schema.messages.id,
          createdAt: schema.messages.createdAt,
          expiresAt: schema.messages.expiresAt,
        });
      const row = inserted[0]!;

      publish(peer, {
        type: "new_message",
        message: {
          id: row.id,
          senderUserId: me,
          header: input.header,
          ciphertext: input.ciphertext,
          createdAt: row.createdAt.toISOString(),
          expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
          groupId: null,
        },
      });

      // Fire-and-forget Web Push; never blocks the send.
      void pushToUser(peer, {
        type: "new_message",
        title: "New message",
        body: "You have a new encrypted message.",
        url: `/chats/${me}`,
      }).catch(() => undefined);

      return { id: row.id, createdAt: row.createdAt.toISOString() };
    }),

  /**
   * Return all undelivered messages for me. Server *does not* delete them
   * — it just returns the list. The client must call `markDelivered`
   * (or send `mark_delivered` over WS) once they're persisted locally,
   * which both records the receipt and notifies the sender.
   *
   * History is preserved on the server (encrypted) so a fresh device can
   * restore it via `fetchHistory`.
   */
  fetchInbox: protectedProcedure
    .output(FetchInboxResult)
    .mutation(async ({ ctx }): Promise<{ messages: InboxMessage[] }> => {
      const db = getDb();
      const now = new Date();
      const rows = await db
        .select()
        .from(schema.messages)
        .where(
          and(
            eq(schema.messages.recipientUserId, ctx.userId),
            isNull(schema.messages.deliveredAt),
            or(
              isNull(schema.messages.expiresAt),
              gt(schema.messages.expiresAt, now),
            ),
          ),
        )
        .orderBy(asc(schema.messages.createdAt))
        .limit(MAX_FETCH);
      return {
        messages: rows.map((r) => ({
          id: r.id,
          senderUserId: r.senderUserId,
          header: bufToB64(r.header),
          ciphertext: bufToB64(r.ciphertext),
          createdAt: r.createdAt.toISOString(),
          expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
          groupId: r.groupId ?? null,
        })),
      };
    }),

  /**
   * @deprecated Old single-shot fetch+delete. Kept so older clients keep
   * working through the rollout. New clients should use `fetchInbox` +
   * `markDelivered`. This now also marks delivered (so sender gets a
   * receipt) but no longer deletes the row.
   */
  fetchAndConsume: protectedProcedure
    .output(FetchInboxResult)
    .mutation(async ({ ctx }): Promise<{ messages: InboxMessage[] }> => {
      const db = getDb();
      const now = new Date();
      const rows = await db
        .select()
        .from(schema.messages)
        .where(
          and(
            eq(schema.messages.recipientUserId, ctx.userId),
            isNull(schema.messages.deliveredAt),
            or(
              isNull(schema.messages.expiresAt),
              gt(schema.messages.expiresAt, now),
            ),
          ),
        )
        .orderBy(asc(schema.messages.createdAt))
        .limit(MAX_FETCH);
      if (rows.length === 0) return { messages: [] };

      const ids = rows.map((r) => r.id);
      await db
        .update(schema.messages)
        .set({ deliveredAt: now })
        .where(inArray(schema.messages.id, ids));

      for (const r of rows) {
        publish(r.senderUserId, {
          type: "delivery_receipt",
          messageId: r.id,
          by: ctx.userId,
          at: now.toISOString(),
        });
      }

      return {
        messages: rows.map((r) => ({
          id: r.id,
          senderUserId: r.senderUserId,
          header: bufToB64(r.header),
          ciphertext: bufToB64(r.ciphertext),
          createdAt: r.createdAt.toISOString(),
          expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
          groupId: r.groupId ?? null,
        })),
      };
    }),

  /** Mark inbox messages as delivered + notify their senders. */
  markDelivered: protectedProcedure
    .input(MarkDeliveredInput)
    .output(OkSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.ids.length === 0) return { ok: true as const };
      const db = getDb();
      const now = new Date();
      const updated = await db
        .update(schema.messages)
        .set({ deliveredAt: now })
        .where(
          and(
            inArray(schema.messages.id, input.ids),
            eq(schema.messages.recipientUserId, ctx.userId),
            isNull(schema.messages.deliveredAt),
          ),
        )
        .returning({
          id: schema.messages.id,
          sender: schema.messages.senderUserId,
        });
      for (const row of updated) {
        publish(row.sender, {
          type: "delivery_receipt",
          messageId: row.id,
          by: ctx.userId,
          at: now.toISOString(),
        });
      }
      return { ok: true as const };
    }),

  /**
   * Mark inbox messages as read + notify the sender.
   * Stealth-mode clients simply never call this.
   */
  markRead: protectedProcedure
    .input(MarkReadInput)
    .output(OkSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.ids.length === 0) return { ok: true as const };
      const db = getDb();
      const now = new Date();
      const updated = await db
        .update(schema.messages)
        .set({ readAt: now })
        .where(
          and(
            inArray(schema.messages.id, input.ids),
            eq(schema.messages.recipientUserId, ctx.userId),
            isNull(schema.messages.readAt),
          ),
        )
        .returning({
          id: schema.messages.id,
          sender: schema.messages.senderUserId,
        });
      for (const row of updated) {
        publish(row.sender, {
          type: "read_receipt",
          messageId: row.id,
          by: ctx.userId,
          at: now.toISOString(),
        });
      }
      return { ok: true as const };
    }),

  /**
   * Paginated history for a single conversation, both directions.
   * Returns newest-first; pass `before` (ISO timestamp from the oldest
   * message you have so far) to page backwards.
   */
  fetchHistory: protectedProcedure
    .input(FetchHistoryInput)
    .output(FetchHistoryResult)
    .query(async ({ ctx, input }): Promise<{
      messages: HistoryMessage[];
      hasMore: boolean;
    }> => {
      const db = getDb();
      const me = ctx.userId;
      const peer = input.peerId;
      if (peer === me) {
        return { messages: [], hasMore: false };
      }

      const [a, b] = me < peer ? [me, peer] : [peer, me];
      const conn = await db
        .select({ id: schema.connections.id })
        .from(schema.connections)
        .where(
          and(
            eq(schema.connections.userAId, a),
            eq(schema.connections.userBId, b),
          ),
        )
        .limit(1);
      if (conn.length === 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not connected to this user.",
        });
      }

      const convId = conversationIdFor(me, peer);
      const limit = input.limit;
      const before = input.before ? new Date(input.before) : null;
      const now = new Date();

      const whereClauses = [
        eq(schema.messages.conversationId, convId),
        or(
          isNull(schema.messages.expiresAt),
          gt(schema.messages.expiresAt, now),
        )!,
      ];
      if (before) whereClauses.push(lt(schema.messages.createdAt, before));

      const rows = await db
        .select()
        .from(schema.messages)
        .where(and(...whereClauses))
        .orderBy(desc(schema.messages.createdAt))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;

      return {
        messages: page.map((r) => ({
          id: r.id,
          senderUserId: r.senderUserId,
          recipientUserId: r.recipientUserId,
          header: bufToB64(r.header),
          ciphertext: bufToB64(r.ciphertext),
          createdAt: r.createdAt.toISOString(),
          expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
          groupId: r.groupId ?? null,
          deliveredAt: r.deliveredAt ? r.deliveredAt.toISOString() : null,
          readAt: r.readAt ? r.readAt.toISOString() : null,
        })),
        hasMore,
      };
    }),

  /**
   * Catch-up endpoint for read/delivered receipts. The sender calls this
   * for any outbound messages whose status is still "sent" or "delivered"
   * — typically on tab focus, network reconnect, or WS reopen — so missed
   * `delivery_receipt`/`read_receipt` events are recovered without waiting
   * for the next message.
   *
   * Only returns rows that the caller actually sent (no info leak).
   */
  fetchReceipts: protectedProcedure
    .input(FetchReceiptsInput)
    .output(FetchReceiptsResult)
    .query(async ({ ctx, input }): Promise<{ receipts: MessageReceipt[] }> => {
      const db = getDb();
      const rows = await db
        .select({
          id: schema.messages.id,
          deliveredAt: schema.messages.deliveredAt,
          readAt: schema.messages.readAt,
        })
        .from(schema.messages)
        .where(
          and(
            inArray(schema.messages.id, input.ids),
            eq(schema.messages.senderUserId, ctx.userId),
          ),
        );
      return {
        receipts: rows.map((r) => ({
          id: r.id,
          deliveredAt: r.deliveredAt ? r.deliveredAt.toISOString() : null,
          readAt: r.readAt ? r.readAt.toISOString() : null,
        })),
      };
    }),

  /**
   * "Delete for everyone": hard-delete the persisted ciphertext of a
   * message the caller sent. The receiver's tombstone is delivered via
   * an encrypted `t:"del"` envelope through the normal send pipeline,
   * so this endpoint only needs to wipe the server row to prevent a
   * fresh device from restoring the message via fetchHistory.
   *
   * Idempotent: missing or already-deleted ids return ok.
   */
  deleteForEveryone: protectedProcedure
    .input(DeleteForEveryoneInput)
    .output(OkSchema)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const rows = await db
        .select({ id: schema.messages.id })
        .from(schema.messages)
        .where(
          and(
            eq(schema.messages.id, input.id),
            eq(schema.messages.senderUserId, ctx.userId),
          ),
        );
      if (rows.length === 0) return { ok: true as const };
      await db
        .delete(schema.messages)
        .where(eq(schema.messages.id, input.id));
      return { ok: true as const };
    }),

  /* ──────────────── Phase 7: Group fan-out ──────────────── */

  /**
   * Send one group message by fanning out per-recipient ciphertexts. Each
   * recipient row carries the same `groupId`. Caller and every recipient
   * must be a member of the group.
   */
  sendGroup: protectedProcedure
    .input(SendGroupMessageInput)
    .output(SendGroupMessageResult)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const me = ctx.userId;

      const myMem = await db
        .select({ id: schema.groupMembers.id })
        .from(schema.groupMembers)
        .where(
          and(
            eq(schema.groupMembers.groupId, input.groupId),
            eq(schema.groupMembers.userId, me),
          ),
        )
        .limit(1);
      if (myMem.length === 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this group.",
        });
      }

      const recipientIds = input.recipients.map((r) => r.recipientUserId);
      if (recipientIds.includes(me)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Don't include yourself in the recipients list.",
        });
      }
      const memberRows = await db
        .select({ userId: schema.groupMembers.userId })
        .from(schema.groupMembers)
        .where(
          and(
            eq(schema.groupMembers.groupId, input.groupId),
            inArray(schema.groupMembers.userId, recipientIds),
          ),
        );
      const valid = new Set(memberRows.map((r) => r.userId));
      const invalid = recipientIds.filter((id) => !valid.has(id));
      if (invalid.length > 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Some recipients are not group members.",
        });
      }

      const expiresAt = input.expiresInSeconds
        ? new Date(Date.now() + input.expiresInSeconds * 1000)
        : null;
      const convId = `g:${input.groupId}`;
      const valuesToInsert = input.recipients.map((r) => ({
        senderUserId: me,
        recipientUserId: r.recipientUserId,
        groupId: input.groupId,
        conversationId: convId,
        header: Buffer.from(r.header, "base64"),
        ciphertext: Buffer.from(r.ciphertext, "base64"),
        expiresAt,
      }));
      const inserted = await db
        .insert(schema.messages)
        .values(valuesToInsert)
        .returning({
          id: schema.messages.id,
          recipientUserId: schema.messages.recipientUserId,
          createdAt: schema.messages.createdAt,
          expiresAt: schema.messages.expiresAt,
        });
      const rowByRecipient = new Map(inserted.map((r) => [r.recipientUserId, r]));

      // Push WS + Web Push
      for (const r of input.recipients) {
        const row = rowByRecipient.get(r.recipientUserId)!;
        publish(r.recipientUserId, {
          type: "new_message",
          message: {
            id: row.id,
            senderUserId: me,
            header: r.header,
            ciphertext: r.ciphertext,
            createdAt: row.createdAt.toISOString(),
            expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
            groupId: input.groupId,
          },
        });
        void pushToUser(r.recipientUserId, {
          type: "new_message",
          title: "New group message",
          body: "You have a new encrypted group message.",
          url: `/groups/${input.groupId}`,
        }).catch(() => undefined);
      }

      const createdAt = inserted[0]!.createdAt.toISOString();
      // Preserve input order in returned ids.
      const ids = input.recipients.map(
        (r) => rowByRecipient.get(r.recipientUserId)!.id,
      );
      return { createdAt, ids };
    }),

  /** Paginated group history for a group I'm a member of. */
  fetchGroupHistory: protectedProcedure
    .input(FetchGroupHistoryInput)
    .output(FetchGroupHistoryResult)
    .query(async ({ ctx, input }): Promise<{
      messages: GroupHistoryMessage[];
      hasMore: boolean;
    }> => {
      const db = getDb();
      const me = ctx.userId;
      const myMem = await db
        .select({ id: schema.groupMembers.id })
        .from(schema.groupMembers)
        .where(
          and(
            eq(schema.groupMembers.groupId, input.groupId),
            eq(schema.groupMembers.userId, me),
          ),
        )
        .limit(1);
      if (myMem.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Group not found." });
      }

      const before = input.before ? new Date(input.before) : null;
      const now = new Date();
      const limit = input.limit;

      // Only return rows addressed to me OR sent by me — we own one
      // fan-out leg per group member, so this gives us a lossless
      // single-stream view of the group thread on this device.
      const whereClauses = [
        eq(schema.messages.groupId, input.groupId),
        or(
          eq(schema.messages.recipientUserId, me),
          eq(schema.messages.senderUserId, me),
        )!,
        or(
          isNull(schema.messages.expiresAt),
          gt(schema.messages.expiresAt, now),
        )!,
      ];
      if (before) whereClauses.push(lt(schema.messages.createdAt, before));

      const rows = await db
        .select()
        .from(schema.messages)
        .where(and(...whereClauses))
        .orderBy(desc(schema.messages.createdAt))
        .limit(limit + 1);

      // Dedup by (sender, createdAt) since outbound messages exist
      // once per recipient leg; for our own outbound we get N rows.
      const seen = new Set<string>();
      const dedup: typeof rows = [];
      for (const r of rows) {
        const key = `${r.senderUserId}:${r.createdAt.toISOString()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        dedup.push(r);
      }

      const hasMore = dedup.length > limit;
      const page = hasMore ? dedup.slice(0, limit) : dedup;

      return {
        messages: page.map((r) => ({
          id: r.id,
          groupId: input.groupId,
          senderUserId: r.senderUserId,
          header: bufToB64(r.header),
          ciphertext: bufToB64(r.ciphertext),
          createdAt: r.createdAt.toISOString(),
          expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
        })),
        hasMore,
      };
    }),
});

// Avoid unused-import warnings for helpers we may want later.
void sql;
