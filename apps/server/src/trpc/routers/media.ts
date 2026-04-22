import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import {
  UploadMediaInput,
  UploadMediaResult,
  DownloadMediaInput,
  DownloadMediaResult,
} from "@veil/shared";
import { protectedProcedure, router } from "../init.js";
import { getDb, schema } from "../../db/index.js";
import { env } from "../../env.js";

export const mediaRouter = router({
  /**
   * Upload an encrypted blob. The server stores opaque ciphertext +
   * the client-supplied MIME hint and returns a blob id. The decryption
   * key never touches the server — it's sent to the recipient inside a
   * Signal-encrypted chat message.
   */
  upload: protectedProcedure
    .input(UploadMediaInput)
    .output(UploadMediaResult)
    .mutation(async ({ ctx, input }) => {
      const buf = Buffer.from(input.ciphertext, "base64");
      if (buf.byteLength === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Empty ciphertext.",
        });
      }
      if (buf.byteLength > env.MEDIA_MAX_BYTES) {
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: `Ciphertext exceeds ${env.MEDIA_MAX_BYTES} bytes.`,
        });
      }

      const db = getDb();
      const expiresAt = new Date(
        Date.now() + env.MEDIA_TTL_HOURS * 3600 * 1000,
      );
      const inserted = await db
        .insert(schema.mediaBlobs)
        .values({
          ownerUserId: ctx.userId,
          mime: input.mime,
          ciphertext: buf,
          sizeBytes: buf.byteLength,
          expiresAt,
        })
        .returning({
          id: schema.mediaBlobs.id,
          sizeBytes: schema.mediaBlobs.sizeBytes,
          expiresAt: schema.mediaBlobs.expiresAt,
        });
      const row = inserted[0]!;
      return {
        blobId: row.id,
        sizeBytes: row.sizeBytes,
        expiresAt: row.expiresAt.toISOString(),
      };
    }),

  /**
   * Download an encrypted blob by id. Authenticated only — the server
   * does not enforce per-recipient ACLs here because the AES-GCM key is
   * required to do anything useful with the ciphertext, and that key is
   * only ever delivered through a Signal-encrypted message between the
   * two parties.
   */
  download: protectedProcedure
    .input(DownloadMediaInput)
    .output(DownloadMediaResult)
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db
        .select({
          ciphertext: schema.mediaBlobs.ciphertext,
          mime: schema.mediaBlobs.mime,
          sizeBytes: schema.mediaBlobs.sizeBytes,
          expiresAt: schema.mediaBlobs.expiresAt,
        })
        .from(schema.mediaBlobs)
        .where(eq(schema.mediaBlobs.id, input.blobId))
        .limit(1);
      const row = rows[0];
      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Media not found or has expired.",
        });
      }
      if (row.expiresAt.getTime() <= Date.now()) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Media has expired.",
        });
      }
      return {
        ciphertext: Buffer.from(row.ciphertext).toString("base64"),
        mime: row.mime,
        sizeBytes: row.sizeBytes,
      };
    }),
});
