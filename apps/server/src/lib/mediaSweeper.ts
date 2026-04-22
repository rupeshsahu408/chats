import type { FastifyBaseLogger } from "fastify";
import { lt } from "drizzle-orm";
import { getDb, schema } from "../db/index.js";
import { deleteObjects, r2Configured } from "./r2.js";

const SWEEP_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Periodically delete expired media blobs — the row in Postgres AND the
 * underlying ciphertext object in R2. Runs every 15 minutes and once
 * shortly after startup.
 */
export function startMediaSweeper(log: FastifyBaseLogger): void {
  const tick = async () => {
    try {
      const db = getDb();
      const expired = await db
        .delete(schema.mediaBlobs)
        .where(lt(schema.mediaBlobs.expiresAt, new Date()))
        .returning({
          id: schema.mediaBlobs.id,
          r2Key: schema.mediaBlobs.r2Key,
        });
      if (expired.length === 0) return;
      if (r2Configured()) {
        try {
          await deleteObjects(expired.map((r) => r.r2Key));
        } catch (err) {
          log.warn(
            { err, count: expired.length },
            "media sweeper: R2 delete failed (rows already removed from DB)",
          );
        }
      }
      log.info(`media sweeper: removed ${expired.length} expired blob(s)`);
    } catch (err) {
      log.warn({ err }, "media sweeper failed");
    }
  };
  setTimeout(() => void tick(), 5_000);
  setInterval(() => void tick(), SWEEP_INTERVAL_MS);
}
