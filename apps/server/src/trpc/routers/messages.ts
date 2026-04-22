import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import {
  SendMessageInput,
  SendMessageResult,
  FetchInboxResult,
  MarkDeliveredInput,
  FetchHistoryInput,
  FetchHistoryResult,
  OkSchema,
  type InboxMessage,
  type HistoryMessage,
} from "@veil/shared";
import { protectedProcedure, router } from "../init.js";
import { getDb, schema } from "../../db/index.js";
import { publish } from "../../lib/wsHub.js";

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

      const headerBuf = Buffer.from(input.header, "base64");
      const ctBuf = Buffer.from(input.ciphertext, "base64");
      const inserted = await db
        .insert(schema.messages)
        .values({
          senderUserId: me,
          recipientUserId: peer,
          conversationId: conversationIdFor(me, peer),
          header: headerBuf,
          ciphertext: ctBuf,
        })
        .returning({
          id: schema.messages.id,
          createdAt: schema.messages.createdAt,
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
        },
      });

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
      const rows = await db
        .select()
        .from(schema.messages)
        .where(
          and(
            eq(schema.messages.recipientUserId, ctx.userId),
            isNull(schema.messages.deliveredAt),
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

      const whereClauses = [eq(schema.messages.conversationId, convId)];
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
        })),
        hasMore,
      };
    }),
});

// Avoid unused-import warnings for helpers we may want later (e.g. or, gt, sql).
void or;
void gt;
void sql;
