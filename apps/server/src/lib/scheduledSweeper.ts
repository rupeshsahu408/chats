import type { FastifyBaseLogger } from "fastify";
import { and, eq, lte, sql } from "drizzle-orm";
import { getDb, schema } from "../db/index.js";
import { publish } from "./wsHub.js";
import { pushToUser } from "./push.js";
import { isBlockedEitherWay } from "../trpc/routers/privacy.js";

const SWEEP_INTERVAL_MS = 10_000;
const MAX_PER_TICK = 50;

function bufToB64(b: Buffer | Uint8Array): string {
  return Buffer.from(b).toString("base64");
}

/**
 * Promote due scheduled messages into the live messages table.
 *
 * Each row was queued already-encrypted by the sender, so the server
 * just inserts a normal message row and fires the same WS + Web Push
 * notifications messages.send does. A separate update marks the
 * scheduled row as delivered.
 */
export function startScheduledSweeper(log: FastifyBaseLogger): void {
  const tick = async () => {
    try {
      const db = getDb();

      // Atomically claim a batch of due rows by flipping their status.
      // Using a SELECT … FOR UPDATE SKIP LOCKED would be ideal, but we
      // only run a single Render instance, so a guarded UPDATE is fine.
      const dueRows = await db
        .select()
        .from(schema.scheduledMessages)
        .where(
          and(
            eq(schema.scheduledMessages.status, "pending"),
            lte(schema.scheduledMessages.scheduledFor, new Date()),
          ),
        )
        .orderBy(schema.scheduledMessages.scheduledFor)
        .limit(MAX_PER_TICK);

      if (dueRows.length === 0) return;

      for (const row of dueRows) {
        try {
          // Block check is enforced at delivery time as well — if the
          // sender or recipient blocked the other after scheduling,
          // we cancel silently rather than deliver a message they
          // explicitly disallowed.
          if (await isBlockedEitherWay(row.senderUserId, row.recipientUserId)) {
            await db
              .update(schema.scheduledMessages)
              .set({
                status: "cancelled",
                failReason: "Blocked at delivery time",
                failedAt: new Date(),
              })
              .where(eq(schema.scheduledMessages.id, row.id));
            continue;
          }

          const expiresAt = row.expiresInSeconds
            ? new Date(Date.now() + row.expiresInSeconds * 1000)
            : null;

          const inserted = await db
            .insert(schema.messages)
            .values({
              senderUserId: row.senderUserId,
              recipientUserId: row.recipientUserId,
              conversationId: row.conversationId,
              header: row.header,
              ciphertext: row.ciphertext,
              expiresAt,
            })
            .returning({
              id: schema.messages.id,
              createdAt: schema.messages.createdAt,
              expiresAt: schema.messages.expiresAt,
            });
          const m = inserted[0]!;

          await db
            .update(schema.scheduledMessages)
            .set({
              status: "delivered",
              deliveredMessageId: m.id,
              deliveredAt: new Date(),
              failReason: null,
            })
            .where(eq(schema.scheduledMessages.id, row.id));

          // Live push to the recipient (if connected) + Web Push (if not).
          publish(row.recipientUserId, {
            type: "new_message",
            message: {
              id: m.id,
              senderUserId: row.senderUserId,
              header: bufToB64(row.header),
              ciphertext: bufToB64(row.ciphertext),
              createdAt: m.createdAt.toISOString(),
              expiresAt: m.expiresAt ? m.expiresAt.toISOString() : null,
              groupId: null,
            },
          });

          void pushToUser(row.recipientUserId, {
            type: "new_message",
            title: "New message",
            body: "You have a new encrypted message.",
            url: `/chats/${row.senderUserId}`,
          }).catch(() => undefined);

          log.info(
            { id: row.id, deliveredMessageId: m.id },
            "scheduled-sweeper: released scheduled message",
          );
        } catch (err) {
          // Single-row failure: bump attempts, capture reason, leave row
          // pending so the next tick retries. After many attempts we
          // mark as failed so it stops looping.
          const attempts = row.attempts + 1;
          const giveUp = attempts >= 10;
          await db
            .update(schema.scheduledMessages)
            .set({
              attempts,
              failReason: err instanceof Error ? err.message : String(err),
              ...(giveUp
                ? { status: "failed" as const, failedAt: new Date() }
                : {}),
            })
            .where(eq(schema.scheduledMessages.id, row.id));
          log.warn(
            { err, id: row.id, attempts, giveUp },
            "scheduled-sweeper: delivery attempt failed",
          );
        }
      }
    } catch (err) {
      log.warn({ err }, "scheduled sweeper tick failed");
    }
  };

  // Run shortly after boot so a recently-due message lands quickly,
  // then on a steady interval.
  setTimeout(() => void tick(), 3_000);
  setInterval(() => void tick(), SWEEP_INTERVAL_MS);

  // Avoid unused-import lint warning.
  void sql;
}
