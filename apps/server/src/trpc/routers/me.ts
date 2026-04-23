import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  PublicUserSchema,
  SetX25519IdentityInput,
  OkSchema,
  UserIdSchema,
  type PublicUser,
} from "@veil/shared";
import { protectedProcedure, router } from "../init.js";
import { getDb, schema } from "../../db/index.js";
import { isOnline } from "../../lib/wsHub.js";

export const meRouter = router({
  get: protectedProcedure
    .output(PublicUserSchema)
    .query(async ({ ctx }): Promise<PublicUser> => {
      const db = getDb();
      const found = await db
        .select({
          id: schema.users.id,
          accountType: schema.users.accountType,
          createdAt: schema.users.createdAt,
        })
        .from(schema.users)
        .where(eq(schema.users.id, ctx.userId))
        .limit(1);
      const row = found[0];
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      return {
        id: row.id,
        accountType: row.accountType,
        createdAt: row.createdAt.toISOString(),
      };
    }),

  /**
   * Phase 3: register the X25519 identity public key for X3DH.
   *
   * Idempotent: setting the same key again is a no-op. Once set, it
   * cannot be changed via this endpoint (would break existing sessions);
   * key rotation will need a separate flow in a later phase.
   */
  setX25519Identity: protectedProcedure
    .input(SetX25519IdentityInput)
    .output(OkSchema)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const pub = Buffer.from(input.publicKey, "base64");
      if (pub.length !== 32) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "X25519 identity key must be 32 bytes.",
        });
      }
      const found = await db
        .select({ x: schema.users.identityX25519Pubkey })
        .from(schema.users)
        .where(eq(schema.users.id, ctx.userId))
        .limit(1);
      const row = found[0];
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      if (row.x) {
        if (Buffer.compare(row.x, pub) !== 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "X25519 identity key is already set and differs from the one provided.",
          });
        }
        return { ok: true as const };
      }
      await db
        .update(schema.users)
        .set({ identityX25519Pubkey: pub })
        .where(eq(schema.users.id, ctx.userId));
      return { ok: true as const };
    }),

  /** Returns whether a peer is currently connected (online). */
  peerOnline: protectedProcedure
    .input(z.object({ peerId: UserIdSchema }))
    .output(z.object({ online: z.boolean() }))
    .query(({ input }) => {
      return { online: isOnline(input.peerId) };
    }),

  /**
   * Returns online status for many peers in a single round-trip.
   * Used by the group chat header to show "N online" without N queries.
   */
  peersOnline: protectedProcedure
    .input(z.object({ peerIds: z.array(UserIdSchema).max(500) }))
    .output(z.object({ online: z.array(UserIdSchema) }))
    .query(({ input }) => {
      const online = input.peerIds.filter((id) => isOnline(id));
      return { online };
    }),

  /**
   * Returns the peer's last-seen timestamp, respecting their privacy setting.
   * Returns null when the peer has hidden their last-seen from the requester.
   */
  peerLastSeen: protectedProcedure
    .input(z.object({ peerId: UserIdSchema }))
    .output(z.object({ lastSeenAt: z.string().nullable() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const peer = await db
        .select({
          lastSeenAt: schema.users.lastSeenAt,
          lastSeenPrivacy: schema.users.lastSeenPrivacy,
        })
        .from(schema.users)
        .where(eq(schema.users.id, input.peerId))
        .limit(1);

      const row = peer[0];
      if (!row) return { lastSeenAt: null };

      const privacy = row.lastSeenPrivacy ?? "contacts";

      if (privacy === "nobody") return { lastSeenAt: null };

      if (privacy === "everyone") {
        return { lastSeenAt: row.lastSeenAt?.toISOString() ?? null };
      }

      // privacy === "contacts" — only return if requester is a connection.
      const [userA, userB] =
        ctx.userId < input.peerId
          ? [ctx.userId, input.peerId]
          : [input.peerId, ctx.userId];

      const conn = await db
        .select({ id: schema.connections.userAId })
        .from(schema.connections)
        .where(
          and(
            eq(schema.connections.userAId, userA),
            eq(schema.connections.userBId, userB),
          ),
        )
        .limit(1);

      if (conn.length === 0) return { lastSeenAt: null };
      return { lastSeenAt: row.lastSeenAt?.toISOString() ?? null };
    }),
});
