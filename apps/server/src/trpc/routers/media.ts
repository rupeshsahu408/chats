import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  RequestMediaUploadInput,
  RequestMediaUploadResult,
  FinalizeMediaUploadInput,
  FinalizeMediaUploadResult,
  DownloadMediaInput,
  DownloadMediaResult,
} from "@veil/shared";
import { protectedProcedure, router } from "../init.js";
import { getDb, schema } from "../../db/index.js";
import { env } from "../../env.js";
import {
  r2Configured,
  missingR2Config,
  presignUpload,
  presignDownload,
  headObject,
  deleteObjects,
} from "../../lib/r2.js";

function requireR2(): void {
  if (!r2Configured()) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `Media storage is not configured. Missing: ${missingR2Config().join(", ")}`,
    });
  }
}

function buildKey(userId: string, blobId: string): string {
  // Path layout makes lifecycle-by-prefix easy if we ever add it on R2.
  return `media/${userId}/${blobId}`;
}

export const mediaRouter = router({
  /**
   * Step 1 of upload. Server creates a row in `media_blobs` (uploaded=false)
   * and returns a short-lived presigned PUT URL that points directly at R2.
   * The client sends the ciphertext to R2 itself — it never travels through
   * this server.
   */
  requestUpload: protectedProcedure
    .input(RequestMediaUploadInput)
    .output(RequestMediaUploadResult)
    .mutation(async ({ ctx, input }) => {
      requireR2();
      if (input.sizeBytes > env.MEDIA_MAX_BYTES) {
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: `Ciphertext exceeds ${env.MEDIA_MAX_BYTES} bytes.`,
        });
      }
      const blobId = randomUUID();
      const r2Key = buildKey(ctx.userId, blobId);
      const expiresAt = new Date(
        Date.now() + env.MEDIA_TTL_HOURS * 3600 * 1000,
      );
      await getDb().insert(schema.mediaBlobs).values({
        id: blobId,
        ownerUserId: ctx.userId,
        mime: input.mime,
        r2Key,
        sizeBytes: 0,
        uploaded: false,
        expiresAt,
      });
      const presigned = await presignUpload(r2Key);
      return {
        blobId,
        uploadUrl: presigned.url,
        uploadContentType: presigned.contentType,
        uploadExpiresAt: presigned.expiresAt.toISOString(),
      };
    }),

  /**
   * Step 2 of upload. The client tells the server it has finished PUTting
   * ciphertext. The server HEADs R2 to confirm the object exists, records
   * the actual size, and flips `uploaded=true`. Only after this does the
   * blob become downloadable.
   */
  finalizeUpload: protectedProcedure
    .input(FinalizeMediaUploadInput)
    .output(FinalizeMediaUploadResult)
    .mutation(async ({ ctx, input }) => {
      requireR2();
      const db = getDb();
      const rows = await db
        .select({
          id: schema.mediaBlobs.id,
          r2Key: schema.mediaBlobs.r2Key,
          ownerUserId: schema.mediaBlobs.ownerUserId,
          expiresAt: schema.mediaBlobs.expiresAt,
        })
        .from(schema.mediaBlobs)
        .where(eq(schema.mediaBlobs.id, input.blobId))
        .limit(1);
      const row = rows[0];
      if (!row || row.ownerUserId !== ctx.userId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Blob not found." });
      }
      const head = await headObject(row.r2Key);
      if (!head.exists) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Ciphertext was not found in storage. Did the upload PUT succeed?",
        });
      }
      if (head.sizeBytes > env.MEDIA_MAX_BYTES) {
        // Clean up oversized objects right away.
        await deleteObjects([row.r2Key]).catch(() => undefined);
        await db
          .delete(schema.mediaBlobs)
          .where(eq(schema.mediaBlobs.id, row.id));
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: `Ciphertext exceeds ${env.MEDIA_MAX_BYTES} bytes.`,
        });
      }
      await db
        .update(schema.mediaBlobs)
        .set({ uploaded: true, sizeBytes: head.sizeBytes })
        .where(eq(schema.mediaBlobs.id, row.id));
      return {
        blobId: row.id,
        sizeBytes: head.sizeBytes,
        expiresAt: row.expiresAt.toISOString(),
      };
    }),

  /**
   * Hand the client a short-lived presigned GET URL pointing at R2.
   * Authenticated only — per-recipient ACLs are unnecessary because the
   * AES-GCM key required to decrypt the bytes only ever travels inside a
   * Signal-encrypted chat message.
   */
  download: protectedProcedure
    .input(DownloadMediaInput)
    .output(DownloadMediaResult)
    .query(async ({ input }) => {
      requireR2();
      const db = getDb();
      const rows = await db
        .select({
          r2Key: schema.mediaBlobs.r2Key,
          mime: schema.mediaBlobs.mime,
          sizeBytes: schema.mediaBlobs.sizeBytes,
          uploaded: schema.mediaBlobs.uploaded,
          expiresAt: schema.mediaBlobs.expiresAt,
        })
        .from(schema.mediaBlobs)
        .where(
          and(
            eq(schema.mediaBlobs.id, input.blobId),
            eq(schema.mediaBlobs.uploaded, true),
          ),
        )
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
      const presigned = await presignDownload(row.r2Key);
      return {
        downloadUrl: presigned.url,
        mime: row.mime,
        sizeBytes: row.sizeBytes,
        expiresAt: presigned.expiresAt.toISOString(),
      };
    }),
});
