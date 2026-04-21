import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import {
  SendMessageInput,
  SendMessageResult,
  FetchInboxResult,
  type InboxMessage,
} from "@veil/shared";
import { protectedProcedure, router } from "../init.js";
import { getDb, schema } from "../../db/index.js";

const MAX_FETCH = 200;

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
          header: headerBuf,
          ciphertext: ctBuf,
        })
        .returning({
          id: schema.messages.id,
          createdAt: schema.messages.createdAt,
        });
      const row = inserted[0]!;
      return { id: row.id, createdAt: row.createdAt.toISOString() };
    }),

  /**
   * Fetch all pending messages for me, in send-order, then delete them
   * from the server. The client is responsible for persisting them.
   *
   * If decryption fails on a particular message, the client should log
   * locally (it's lost from the server's perspective) — but with a
   * single-device model this is acceptable, since session state lives
   * on this device only.
   */
  fetchAndConsume: protectedProcedure
    .output(FetchInboxResult)
    .mutation(async ({ ctx }): Promise<{ messages: InboxMessage[] }> => {
      const db = getDb();
      const rows = await db
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.recipientUserId, ctx.userId))
        .orderBy(asc(schema.messages.createdAt))
        .limit(MAX_FETCH);
      if (rows.length === 0) return { messages: [] };

      const ids = rows.map((r) => r.id);
      await db
        .delete(schema.messages)
        .where(inArray(schema.messages.id, ids));

      return {
        messages: rows.map((r) => ({
          id: r.id,
          senderUserId: r.senderUserId,
          header: Buffer.from(r.header).toString("base64"),
          ciphertext: Buffer.from(r.ciphertext).toString("base64"),
          createdAt: r.createdAt.toISOString(),
        })),
      };
    }),
});
