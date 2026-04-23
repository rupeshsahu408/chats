import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  CreateScheduledMessageInput,
  CreateScheduledMessageResult,
  ListScheduledMessagesResult,
  CancelScheduledMessageInput,
  OkSchema,
  type ScheduledMessage,
} from "@veil/shared";
import { protectedProcedure, router } from "../init.js";
import { getDb, schema } from "../../db/index.js";
import { isBlockedEitherWay } from "./privacy.js";

const MIN_LEAD_MS = 5_000;
const MAX_LEAD_MS = 365 * 24 * 60 * 60 * 1000;
const MAX_PENDING_PER_USER = 200;

function conversationIdFor(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export const scheduledRouter = router({
  /**
   * Queue an already-encrypted message for future delivery. The server
   * stores opaque header + ciphertext exactly as the client computed
   * them at scheduling time — same shape as messages.send. The
   * background sweeper releases the row at scheduledFor by inserting
   * into messages and notifying the recipient.
   */
  create: protectedProcedure
    .input(CreateScheduledMessageInput)
    .output(CreateScheduledMessageResult)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const me = ctx.userId;
      const peer = input.recipientUserId;
      if (peer === me) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You can't schedule a message to yourself.",
        });
      }

      const due = new Date(input.scheduledFor);
      if (Number.isNaN(due.getTime())) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid scheduledFor timestamp.",
        });
      }
      const lead = due.getTime() - Date.now();
      if (lead < MIN_LEAD_MS) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Scheduled time must be at least a few seconds in the future.",
        });
      }
      if (lead > MAX_LEAD_MS) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Scheduled time can be at most one year in the future.",
        });
      }

      // Must be connected.
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

      // Soft per-user cap to prevent abuse.
      const pendingCount = await db
        .select({ id: schema.scheduledMessages.id })
        .from(schema.scheduledMessages)
        .where(
          and(
            eq(schema.scheduledMessages.senderUserId, me),
            eq(schema.scheduledMessages.status, "pending"),
          ),
        );
      if (pendingCount.length >= MAX_PENDING_PER_USER) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `You already have ${MAX_PENDING_PER_USER} scheduled messages pending. Cancel some first.`,
        });
      }

      const headerBuf = Buffer.from(input.header, "base64");
      const ctBuf = Buffer.from(input.ciphertext, "base64");

      const inserted = await db
        .insert(schema.scheduledMessages)
        .values({
          senderUserId: me,
          recipientUserId: peer,
          conversationId: conversationIdFor(me, peer),
          header: headerBuf,
          ciphertext: ctBuf,
          expiresInSeconds: input.expiresInSeconds ?? null,
          scheduledFor: due,
        })
        .returning({
          id: schema.scheduledMessages.id,
          scheduledFor: schema.scheduledMessages.scheduledFor,
        });

      const row = inserted[0]!;
      return {
        id: row.id,
        scheduledFor: row.scheduledFor.toISOString(),
      };
    }),

  /** List my scheduled messages (pending + recently delivered/failed). */
  list: protectedProcedure
    .output(ListScheduledMessagesResult)
    .query(async ({ ctx }): Promise<{ scheduled: ScheduledMessage[] }> => {
      const db = getDb();
      const rows = await db
        .select({
          id: schema.scheduledMessages.id,
          recipientUserId: schema.scheduledMessages.recipientUserId,
          scheduledFor: schema.scheduledMessages.scheduledFor,
          status: schema.scheduledMessages.status,
          attempts: schema.scheduledMessages.attempts,
          createdAt: schema.scheduledMessages.createdAt,
          deliveredAt: schema.scheduledMessages.deliveredAt,
          failReason: schema.scheduledMessages.failReason,
        })
        .from(schema.scheduledMessages)
        .where(eq(schema.scheduledMessages.senderUserId, ctx.userId))
        .orderBy(
          asc(schema.scheduledMessages.scheduledFor),
          desc(schema.scheduledMessages.createdAt),
        )
        .limit(500);
      return {
        scheduled: rows.map((r) => ({
          id: r.id,
          recipientUserId: r.recipientUserId,
          scheduledFor: r.scheduledFor.toISOString(),
          status: r.status,
          attempts: r.attempts,
          createdAt: r.createdAt.toISOString(),
          deliveredAt: r.deliveredAt ? r.deliveredAt.toISOString() : null,
          failReason: r.failReason ?? null,
        })),
      };
    }),

  /** Cancel a pending scheduled message I own. */
  cancel: protectedProcedure
    .input(CancelScheduledMessageInput)
    .output(OkSchema)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const updated = await db
        .update(schema.scheduledMessages)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(schema.scheduledMessages.id, input.id),
            eq(schema.scheduledMessages.senderUserId, ctx.userId),
            eq(schema.scheduledMessages.status, "pending"),
          ),
        )
        .returning({ id: schema.scheduledMessages.id });
      if (updated.length === 0) {
        // Idempotent: already delivered/cancelled or not ours — just ok.
        return { ok: true as const };
      }
      return { ok: true as const };
    }),
});
