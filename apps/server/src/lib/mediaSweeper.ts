import type { FastifyBaseLogger } from "fastify";
import { lt } from "drizzle-orm";
import { getDb, schema } from "../db/index.js";

const SWEEP_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Periodically delete expired media blobs. Runs every 15 minutes and
 * also once immediately at startup.
 */
export function startMediaSweeper(log: FastifyBaseLogger): void {
  const tick = async () => {
    try {
      const db = getDb();
      const deleted = await db
        .delete(schema.mediaBlobs)
        .where(lt(schema.mediaBlobs.expiresAt, new Date()))
        .returning({ id: schema.mediaBlobs.id });
      if (deleted.length > 0) {
        log.info(`media sweeper: removed ${deleted.length} expired blob(s)`);
      }
    } catch (err) {
      log.warn({ err }, "media sweeper failed");
    }
  };
  setTimeout(() => void tick(), 5_000);
  setInterval(() => void tick(), SWEEP_INTERVAL_MS);
}
