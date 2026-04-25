import { TRPCError } from "@trpc/server";
import { and, eq, isNull, sql, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { ed25519 } from "@noble/curves/ed25519.js";
import {
  UploadPrekeysInputV2,
  PrekeyStatusSchema,
  PrekeyBundleSchemaV2,
  MySignedPreKeyResultSchema,
  type PrekeyBundleV2,
  type PrekeyStatus,
  type MySignedPreKeyResult,
  UserIdSchema,
} from "@veil/shared";
import { z } from "zod";
import { protectedProcedure, router } from "../init.js";
import { getDb, schema } from "../../db/index.js";

const MAX_OTPK_PER_USER = 100;

function b64ToBuffer(s: string): Buffer {
  return Buffer.from(s, "base64");
}
function bufferToB64(b: Buffer | Uint8Array): string {
  return Buffer.from(b).toString("base64");
}

/**
 * True if `me` is allowed to talk to `peer` over the 1:1 ratchet —
 * either because they're directly connected, OR because they share at
 * least one group. The shared-group case is what lets group members
 * transparently exchange Sender Key Distribution Messages even when
 * they aren't in each other's contacts. Without this, group messages
 * between non-connected members silently fail to encrypt.
 */
async function canCommunicate(
  db: ReturnType<typeof getDb>,
  me: string,
  peer: string,
): Promise<boolean> {
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
  if (conn.length > 0) return true;

  // Shared-group fallback via a self-join on group_members. Using
  // raw db.execute(sql) here is fragile because the result shape
  // differs between drizzle drivers (postgres-js returns an array,
  // node-postgres returns { rows }) — go through drizzle's typed
  // select so it works on both.
  const peerGm = alias(schema.groupMembers, "peer_gm");
  const shared = await db
    .select({ id: schema.groupMembers.id })
    .from(schema.groupMembers)
    .innerJoin(peerGm, eq(peerGm.groupId, schema.groupMembers.groupId))
    .where(
      and(
        eq(schema.groupMembers.userId, me),
        eq(peerGm.userId, peer),
      ),
    )
    .limit(1);
  return shared.length > 0;
}

export const prekeysRouter = router({
  /**
   * Upload (replace) the signed prekey and append one-time prekeys.
   * Total OTPKs per user are capped at 100.
   */
  upload: protectedProcedure
    .input(UploadPrekeysInputV2)
    .output(PrekeyStatusSchema)
    .mutation(async ({ ctx, input }): Promise<PrekeyStatus> => {
      const db = getDb();
      const userId = ctx.userId;

      // If we're swapping curves (Phase 2 → Phase 3 migration), wipe
      // existing one-time prekeys before inserting the new batch.
      if (input.replaceOneTime) {
        await db
          .delete(schema.oneTimePrekeys)
          .where(eq(schema.oneTimePrekeys.userId, userId));
      }

      // Validate raw lengths.
      const spkPub = b64ToBuffer(input.signedPreKey.publicKey);
      const spkSig = b64ToBuffer(input.signedPreKey.signature);
      if (spkPub.length !== 32) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "signedPreKey.publicKey must be 32 bytes.",
        });
      }
      if (spkSig.length !== 64) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "signedPreKey.signature must be 64 bytes.",
        });
      }
      for (const otpk of input.oneTimePreKeys) {
        if (b64ToBuffer(otpk.publicKey).length !== 32) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Each one-time prekey must be 32 bytes.",
          });
        }
      }

      // Verify the signed prekey signature against the *server's* copy
      // of the user's identity public key. This is the authoritative
      // identity peers will use to verify the SPK during X3DH, so it's
      // the only thing that matters. Without this check, a buggy or
      // out-of-sync client can upload a SPK signed by a different
      // Ed25519 key — peers then hit "signature did not verify" when
      // they try to send the user a message, which is exactly the
      // failure mode we keep seeing in production. Failing fast at
      // upload time means the affected client gets an immediate, clear
      // error instead of silently poisoning every future incoming
      // session.
      const idRow = await db
        .select({ identityPubkey: schema.users.identityPubkey })
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1);
      const idPub = idRow[0]?.identityPubkey;
      if (!idPub) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Identity key not registered for this account.",
        });
      }
      let sigValid = false;
      try {
        sigValid = ed25519.verify(
          Uint8Array.from(spkSig),
          Uint8Array.from(spkPub),
          Uint8Array.from(idPub),
        );
      } catch {
        sigValid = false;
      }
      if (!sigValid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Signed prekey signature does not verify against your account's identity key. Your device's signing key has drifted out of sync with your account — please sign in again with your recovery phrase or PIN.",
        });
      }

      // Replace the signed prekey atomically.
      await db
        .insert(schema.signedPrekeys)
        .values({
          userId,
          keyId: input.signedPreKey.keyId,
          publicKey: spkPub,
          signature: spkSig,
        })
        .onConflictDoUpdate({
          target: schema.signedPrekeys.userId,
          set: {
            keyId: input.signedPreKey.keyId,
            publicKey: spkPub,
            signature: spkSig,
            createdAt: new Date(),
          },
        });

      if (input.oneTimePreKeys.length > 0) {
        // Refuse if it would push the total above the cap.
        const existing = input.replaceOneTime
          ? [{ c: 0 }]
          : await db
              .select({ c: sql<number>`count(*)::int` })
              .from(schema.oneTimePrekeys)
              .where(
                and(
                  eq(schema.oneTimePrekeys.userId, userId),
                  isNull(schema.oneTimePrekeys.claimedAt),
                ),
              );
        const have = existing[0]?.c ?? 0;
        if (have + input.oneTimePreKeys.length > MAX_OTPK_PER_USER) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Too many one-time prekeys; cap is ${MAX_OTPK_PER_USER}.`,
          });
        }

        await db
          .insert(schema.oneTimePrekeys)
          .values(
            input.oneTimePreKeys.map((k) => ({
              userId,
              keyId: k.keyId,
              publicKey: b64ToBuffer(k.publicKey),
            })),
          )
          .onConflictDoNothing({
            target: [
              schema.oneTimePrekeys.userId,
              schema.oneTimePrekeys.keyId,
            ],
          });
      }

      return await getStatus(db, userId);
    }),

  /** How many keys does the server currently hold for me? */
  status: protectedProcedure
    .output(PrekeyStatusSchema)
    .query(async ({ ctx }): Promise<PrekeyStatus> => {
      return await getStatus(getDb(), ctx.userId);
    }),

  /**
   * Return the caller's own signed prekey + identity public key as
   * the server has them. Lets the client run a self-audit after
   * unlock: if the signature on file no longer verifies against the
   * identity key on file (or the identity key on file no longer
   * matches the one in this device's local store), the client knows
   * to either re-upload fresh prekeys or surface an account-recovery
   * prompt. This is the runtime self-heal that complements the
   * upload-time signature check above and unblocks accounts whose
   * stored SPK was poisoned by older client versions.
   */
  mySignedPreKey: protectedProcedure
    .output(MySignedPreKeyResultSchema)
    .query(async ({ ctx }): Promise<MySignedPreKeyResult> => {
      const db = getDb();
      const u = await db
        .select({ identityPubkey: schema.users.identityPubkey })
        .from(schema.users)
        .where(eq(schema.users.id, ctx.userId))
        .limit(1);
      const ur = u[0];
      if (!ur) throw new TRPCError({ code: "NOT_FOUND" });
      const spk = await db
        .select({
          keyId: schema.signedPrekeys.keyId,
          publicKey: schema.signedPrekeys.publicKey,
          signature: schema.signedPrekeys.signature,
        })
        .from(schema.signedPrekeys)
        .where(eq(schema.signedPrekeys.userId, ctx.userId))
        .limit(1);
      const sr = spk[0];
      return {
        identityPublicKey: bufferToB64(ur.identityPubkey),
        signedPreKey: sr
          ? {
              keyId: sr.keyId,
              publicKey: bufferToB64(sr.publicKey),
              signature: bufferToB64(sr.signature),
            }
          : null,
      };
    }),

  /**
   * Claim a prekey bundle for a peer. Caller must be already connected
   * to the peer. One one-time prekey is consumed atomically.
   */
  /**
   * Return just the identity public key for a connected peer. Used by
   * the safety-number screen so we don't have to claim a OTPK every time
   * the user wants to verify a fingerprint.
   */
  identityKeyFor: protectedProcedure
    .input(z.object({ userId: UserIdSchema }))
    .output(z.object({ identityPublicKey: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const me = ctx.userId;
      const peer = input.userId;
      if (peer !== me) {
        const allowed = await canCommunicate(db, me, peer);
        if (!allowed) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Not connected to this user.",
          });
        }
      }
      const rows = await db
        .select({ identityPubkey: schema.users.identityPubkey })
        .from(schema.users)
        .where(eq(schema.users.id, peer))
        .limit(1);
      const r = rows[0];
      if (!r) throw new TRPCError({ code: "NOT_FOUND" });
      return { identityPublicKey: bufferToB64(r.identityPubkey) };
    }),

  claimBundleFor: protectedProcedure
    .input(z.object({ peerId: UserIdSchema }))
    .output(PrekeyBundleSchemaV2)
    .mutation(async ({ ctx, input }): Promise<PrekeyBundleV2> => {
      const db = getDb();
      const me = ctx.userId;
      const peer = input.peerId;

      // Must be connected — directly OR via a shared group (so group
      // members can exchange Sender Key Distribution Messages without
      // first having to be each other's 1:1 contacts).
      const allowed = await canCommunicate(db, me, peer);
      if (!allowed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not connected to this user.",
        });
      }

      const peerRow = await db
        .select({
          id: schema.users.id,
          identityPubkey: schema.users.identityPubkey,
          identityX25519Pubkey: schema.users.identityX25519Pubkey,
        })
        .from(schema.users)
        .where(eq(schema.users.id, peer))
        .limit(1);
      const pr = peerRow[0];
      if (!pr) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const spk = await db
        .select()
        .from(schema.signedPrekeys)
        .where(eq(schema.signedPrekeys.userId, peer))
        .limit(1);
      const spkRow = spk[0];
      if (!spkRow) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Peer has not uploaded a signed prekey yet.",
        });
      }

      // Atomically claim one OTPK if available. We previously used
      // `db.execute(sql\`UPDATE … RETURNING …\`)` and read `.rows[0]`,
      // but the postgres-js driver returns the rows as the result
      // itself (an array), so `.rows` was always undefined and the
      // claim path 500'd in production. Going through drizzle's typed
      // update keeps the SKIP LOCKED + atomic-claim semantics while
      // working on every supported driver.
      const claimedRows = await db
        .update(schema.oneTimePrekeys)
        .set({ claimedAt: new Date(), claimedByUserId: me })
        .where(
          eq(
            schema.oneTimePrekeys.id,
            sql`(
              SELECT ${schema.oneTimePrekeys.id} FROM ${schema.oneTimePrekeys}
              WHERE ${schema.oneTimePrekeys.userId} = ${peer}
                AND ${schema.oneTimePrekeys.claimedAt} IS NULL
              ORDER BY ${schema.oneTimePrekeys.createdAt} ASC
              LIMIT 1
              FOR UPDATE SKIP LOCKED
            )`,
          ),
        )
        .returning({
          keyId: schema.oneTimePrekeys.keyId,
          publicKey: schema.oneTimePrekeys.publicKey,
        });
      const otpkRow = claimedRows[0];

      return {
        userId: pr.id,
        identityPublicKey: bufferToB64(pr.identityPubkey),
        identityX25519PublicKey: pr.identityX25519Pubkey
          ? bufferToB64(pr.identityX25519Pubkey)
          : null,
        signedPreKey: {
          keyId: spkRow.keyId,
          publicKey: bufferToB64(spkRow.publicKey),
          signature: bufferToB64(spkRow.signature),
        },
        oneTimePreKey: otpkRow
          ? {
              keyId: otpkRow.keyId,
              publicKey: bufferToB64(otpkRow.publicKey),
            }
          : null,
      };
    }),
});

async function getStatus(
  db: ReturnType<typeof getDb>,
  userId: string,
): Promise<PrekeyStatus> {
  const [spk] = await db
    .select({ keyId: schema.signedPrekeys.keyId })
    .from(schema.signedPrekeys)
    .where(eq(schema.signedPrekeys.userId, userId))
    .limit(1);
  const [count] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(schema.oneTimePrekeys)
    .where(
      and(
        eq(schema.oneTimePrekeys.userId, userId),
        isNull(schema.oneTimePrekeys.claimedAt),
      ),
    );
  // Avoid unused-import warnings if we later prune helpers.
  void or;
  return {
    hasSignedPreKey: !!spk,
    signedPreKeyId: spk?.keyId ?? null,
    oneTimePreKeyCount: count?.c ?? 0,
  };
}
