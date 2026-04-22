import type { FastifyBaseLogger } from "fastify";
import { and, isNotNull, lt } from "drizzle-orm";
import { getDb, schema } from "../db/index.js";

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Periodically delete server-side message rows whose `expires_at`
 * (disappearing-message TTL) is in the past. The actual envelope is
 * always opaque to the server; the client mirrors expiry locally so
 * the UX is symmetric.
 */
export function startMessageSweeper(log: FastifyBaseLogger): void {
  const tick = async () => {
    try {
      const db = getDb();
      const expired = await db
        .delete(schema.messages)
        .where(
          and(
            isNotNull(schema.messages.expiresAt),
            lt(schema.messages.expiresAt, new Date()),
          ),
        )
        .returning({ id: schema.messages.id });
      if (expired.length > 0) {
        log.info(`message sweeper: removed ${expired.length} expired row(s)`);
      }
    } catch (err) {
      log.warn({ err }, "message sweeper failed");
    }
  };
  setTimeout(() => void tick(), 7_000);
  setInterval(() => void tick(), SWEEP_INTERVAL_MS);
}
