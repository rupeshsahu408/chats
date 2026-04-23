import { TRPCError } from "@trpc/server";
import { and, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";
import {
  PublicUserSchema,
  SetX25519IdentityInput,
  OkSchema,
  UserIdSchema,
  UpdateProfileInput,
  UsernameSchema,
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
          username: schema.users.username,
          displayName: schema.users.displayName,
          bio: schema.users.bio,
          avatarDataUrl: schema.users.avatarDataUrl,
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
        username: row.username ?? null,
        displayName: row.displayName ?? null,
        bio: row.bio ?? null,
        avatarDataUrl: row.avatarDataUrl ?? null,
      };
    }),

  /**
   * Update the optional public profile fields. Username is intentionally
   * NOT editable here — it is set once at signup and permanent. Pass
   * `null` for any field to clear it; omit a field to leave it unchanged.
   */
  updateProfile: protectedProcedure
    .input(UpdateProfileInput)
    .output(PublicUserSchema)
    .mutation(async ({ ctx, input }): Promise<PublicUser> => {
      const db = getDb();

      const patch: Record<string, string | null> = {};
      if (input.displayName !== undefined) {
        patch.displayName = input.displayName ? input.displayName : null;
      }
      if (input.bio !== undefined) {
        patch.bio = input.bio ? input.bio : null;
      }
      if (input.avatarDataUrl !== undefined) {
        if (input.avatarDataUrl !== null) {
          if (!/^data:image\/(png|jpeg|jpg|webp);base64,/.test(input.avatarDataUrl)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "avatarDataUrl must be an image/png|jpeg|webp data URL.",
            });
          }
        }
        patch.avatarDataUrl = input.avatarDataUrl;
      }

      if (Object.keys(patch).length > 0) {
        await db
          .update(schema.users)
          .set(patch)
          .where(eq(schema.users.id, ctx.userId));
      }

      const found = await db
        .select({
          id: schema.users.id,
          accountType: schema.users.accountType,
          createdAt: schema.users.createdAt,
          username: schema.users.username,
          displayName: schema.users.displayName,
          bio: schema.users.bio,
          avatarDataUrl: schema.users.avatarDataUrl,
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
        username: row.username ?? null,
        displayName: row.displayName ?? null,
        bio: row.bio ?? null,
        avatarDataUrl: row.avatarDataUrl ?? null,
      };
    }),

  /**
   * Public profile lookup by username. Used by chat headers, contact
   * lists and the discover-by-username flow so we can show the
   * displayName + avatar instead of the random ID.
   */
  lookupByUsername: protectedProcedure
    .input(z.object({ username: UsernameSchema }))
    .output(PublicUserSchema.nullable())
    .query(async ({ input }) => {
      const db = getDb();
      const found = await db
        .select({
          id: schema.users.id,
          accountType: schema.users.accountType,
          createdAt: schema.users.createdAt,
          username: schema.users.username,
          displayName: schema.users.displayName,
          bio: schema.users.bio,
          avatarDataUrl: schema.users.avatarDataUrl,
        })
        .from(schema.users)
        .where(eq(schema.users.username, input.username))
        .limit(1);
      const row = found[0];
      if (!row) return null;
      return {
        id: row.id,
        accountType: row.accountType,
        createdAt: row.createdAt.toISOString(),
        username: row.username ?? null,
        displayName: row.displayName ?? null,
        bio: row.bio ?? null,
        avatarDataUrl: row.avatarDataUrl ?? null,
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

  /**
   * Batched version of `peerLastSeen` — returns each peer's last-seen ISO
   * timestamp (or null when hidden by privacy / no connection).
   */
  peersLastSeen: protectedProcedure
    .input(z.object({ peerIds: z.array(UserIdSchema).max(500) }))
    .output(
      z.object({
        lastSeen: z.array(
          z.object({
            userId: UserIdSchema,
            lastSeenAt: z.string().nullable(),
          }),
        ),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (input.peerIds.length === 0) return { lastSeen: [] };
      const db = getDb();
      const rows = await db
        .select({
          id: schema.users.id,
          lastSeenAt: schema.users.lastSeenAt,
          lastSeenPrivacy: schema.users.lastSeenPrivacy,
        })
        .from(schema.users)
        .where(inArray(schema.users.id, input.peerIds));

      // Pull the requester's connections once so "contacts"-privacy peers
      // can be resolved without N queries.
      const myConns = await db
        .select({
          a: schema.connections.userAId,
          b: schema.connections.userBId,
        })
        .from(schema.connections)
        .where(
          or(
            eq(schema.connections.userAId, ctx.userId),
            eq(schema.connections.userBId, ctx.userId),
          ),
        );
      const connected = new Set<string>();
      for (const c of myConns) {
        connected.add(c.a === ctx.userId ? c.b : c.a);
      }

      const byId = new Map<string, (typeof rows)[number]>();
      for (const r of rows) byId.set(r.id, r);

      const lastSeen = input.peerIds.map((peerId) => {
        const row = byId.get(peerId);
        if (!row) return { userId: peerId, lastSeenAt: null };
        const privacy = row.lastSeenPrivacy ?? "contacts";
        if (privacy === "nobody") return { userId: peerId, lastSeenAt: null };
        if (privacy === "contacts" && !connected.has(peerId)) {
          return { userId: peerId, lastSeenAt: null };
        }
        return {
          userId: peerId,
          lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
        };
      });

      return { lastSeen };
    }),
});
