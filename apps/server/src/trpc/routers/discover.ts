import { TRPCError } from "@trpc/server";
import { and, desc, eq, ilike, or, ne, notInArray, sql } from "drizzle-orm";
import {
  ListDiscoverableUsersInput,
  ListDiscoverableUsersResult,
  GetDiscoverableUserInput,
  GetDiscoverableUserResult,
  GetDiscoverabilityResult,
  SetDiscoverabilityInput,
  SetDiscoverabilityResult,
  type DiscoverableUser,
} from "@veil/shared";
import { protectedProcedure, router } from "../init.js";
import { getDb, schema } from "../../db/index.js";
import { isBlockedEitherWay } from "./privacy.js";

const PAGE_SIZE = 30;

function shape(u: {
  id: string;
  accountType: "email" | "phone" | "random";
  createdAt: Date;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  avatarDataUrl: string | null;
}): DiscoverableUser {
  return {
    id: u.id,
    accountType: u.accountType,
    createdAt: u.createdAt.toISOString(),
    username: u.username ?? null,
    displayName: u.displayName ?? null,
    bio: u.bio ?? null,
    avatarDataUrl: u.avatarDataUrl ?? null,
  };
}

export const discoverRouter = router({
  /** Read the caller's own opt-in flag for the public directory. */
  getDiscoverability: protectedProcedure
    .output(GetDiscoverabilityResult)
    .query(async ({ ctx }) => {
      const db = getDb();
      const rows = await db
        .select({ v: schema.users.isDiscoverable })
        .from(schema.users)
        .where(eq(schema.users.id, ctx.userId))
        .limit(1);
      return { enabled: rows[0]?.v ?? false };
    }),

  /** Toggle the caller's listing in the public directory. */
  setDiscoverability: protectedProcedure
    .input(SetDiscoverabilityInput)
    .output(SetDiscoverabilityResult)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .update(schema.users)
        .set({ isDiscoverable: input.enabled })
        .where(eq(schema.users.id, ctx.userId));
      return { ok: true as const, enabled: input.enabled };
    }),

  /**
   * Paginated, alphabetised list of users who have opted in to the
   * public directory. Excludes the caller and anyone in a mutual block
   * relationship with the caller. Optional case-insensitive search by
   * username or display name.
   */
  listUsers: protectedProcedure
    .input(ListDiscoverableUsersInput)
    .output(ListDiscoverableUsersResult)
    .query(async ({ ctx, input }) => {
      const db = getDb();

      // Pull the caller's blocked / blocked-by sets so we can exclude
      // them server-side. These lists are typically small.
      const blockedRows = await db
        .select({
          a: schema.blocks.blockerUserId,
          b: schema.blocks.blockedUserId,
        })
        .from(schema.blocks)
        .where(
          or(
            eq(schema.blocks.blockerUserId, ctx.userId),
            eq(schema.blocks.blockedUserId, ctx.userId),
          ),
        );
      const excludeIds = new Set<string>([ctx.userId]);
      for (const r of blockedRows) {
        excludeIds.add(r.a);
        excludeIds.add(r.b);
      }

      const search = input.search?.trim();
      const conditions = [
        eq(schema.users.isDiscoverable, true),
        ne(schema.users.id, ctx.userId),
      ];
      if (excludeIds.size > 1) {
        conditions.push(
          notInArray(schema.users.id, Array.from(excludeIds)),
        );
      }
      if (search) {
        // Case-insensitive prefix-or-contains match across username or
        // display name. Both columns are nullable, so wrap in OR.
        const pattern = `%${search}%`;
        conditions.push(
          or(
            ilike(schema.users.username, pattern),
            ilike(schema.users.displayName, pattern),
          )!,
        );
      }

      // Cursor pagination on (lower(displayName/username), id) so we
      // get a deterministic order even when many users share a sort
      // key. We expose the cursor as `${sortKey}\x00${id}`.
      const cursor = input.cursor;
      if (cursor) {
        const sep = cursor.indexOf("\x00");
        if (sep > 0) {
          const sortKey = cursor.slice(0, sep);
          const lastId = cursor.slice(sep + 1);
          conditions.push(
            sql`(lower(coalesce(${schema.users.displayName}, ${schema.users.username}, '')), ${schema.users.id}) > (${sortKey}, ${lastId})`,
          );
        }
      }

      const rows = await db
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
        .where(and(...conditions))
        .orderBy(
          sql`lower(coalesce(${schema.users.displayName}, ${schema.users.username}, ''))`,
          schema.users.id,
        )
        .limit(PAGE_SIZE + 1);

      const hasMore = rows.length > PAGE_SIZE;
      const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
      let nextCursor: string | null = null;
      if (hasMore) {
        const last = page[page.length - 1]!;
        const sortKey = (
          last.displayName ??
          last.username ??
          ""
        ).toLowerCase();
        nextCursor = `${sortKey}\x00${last.id}`;
      }

      return {
        users: page.map(shape),
        nextCursor,
      };
    }),

  /**
   * Single-user profile for the Discover detail page. Returns the same
   * shape as `listUsers` plus a relationship hint so the UI can decide
   * which action button to show (Send chat request / Pending /
   * Connected / Blocked).
   */
  getUser: protectedProcedure
    .input(GetDiscoverableUserInput)
    .output(GetDiscoverableUserResult)
    .query(async ({ ctx, input }) => {
      if (input.userId === ctx.userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That's you.",
        });
      }

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
          isDiscoverable: schema.users.isDiscoverable,
        })
        .from(schema.users)
        .where(eq(schema.users.id, input.userId))
        .limit(1);
      const user = found[0];
      if (!user || !user.isDiscoverable) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found.",
        });
      }

      if (await isBlockedEitherWay(ctx.userId, input.userId)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can't view this profile right now.",
        });
      }

      // Relationship: connected / pending(out) / pending(in) / none.
      const me = ctx.userId;
      const peer = input.userId;
      const [a, b] = me < peer ? [me, peer] : [peer, me];

      const [connRows, pendingRows] = await Promise.all([
        db
          .select({ id: schema.connections.id })
          .from(schema.connections)
          .where(
            and(
              eq(schema.connections.userAId, a),
              eq(schema.connections.userBId, b),
            ),
          )
          .limit(1),
        db
          .select({
            id: schema.connectionRequests.id,
            from: schema.connectionRequests.fromUserId,
          })
          .from(schema.connectionRequests)
          .where(
            and(
              eq(schema.connectionRequests.status, "pending"),
              or(
                and(
                  eq(schema.connectionRequests.fromUserId, me),
                  eq(schema.connectionRequests.toUserId, peer),
                ),
                and(
                  eq(schema.connectionRequests.fromUserId, peer),
                  eq(schema.connectionRequests.toUserId, me),
                ),
              ),
            ),
          )
          .limit(1),
      ]);

      let relationship: "none" | "connected" | "pending_out" | "pending_in" =
        "none";
      if (connRows.length > 0) relationship = "connected";
      else if (pendingRows[0]) {
        relationship =
          pendingRows[0].from === me ? "pending_out" : "pending_in";
      }

      return {
        user: shape(user),
        relationship,
      };
    }),
});

// Suppress unused import — desc is reserved for future "newest first"
// sort modes; keep the import so a follow-up doesn't have to re-add it.
void desc;
