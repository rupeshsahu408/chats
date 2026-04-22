import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { createHmac, randomUUID } from "node:crypto";
import {
  IncomingRequestSchema,
  OutgoingRequestSchema,
  ConnectionSchema,
  PeerIdInput,
  RequestIdInput,
  OkSchema,
  GetDiscoverySaltResult,
  DiscoverContactsInput,
  DiscoverContactsResult,
  type IncomingRequest,
  type OutgoingRequest,
  type Connection,
  type Peer,
} from "@veil/shared";
import { z } from "zod";
import { protectedProcedure, router } from "../init.js";
import { getDb, schema } from "../../db/index.js";
import { fingerprintForPublicKey } from "../../lib/fingerprint.js";
import { env } from "../../env.js";

const SALT_TTL_MS = 5 * 60 * 1000;
const discoverySalts = new Map<string, { salt: string; expiresAt: number }>();

function pruneExpiredSalts() {
  const now = Date.now();
  for (const [id, s] of discoverySalts) {
    if (s.expiresAt <= now) discoverySalts.delete(id);
  }
}

function peer(u: {
  id: string;
  accountType: "email" | "phone" | "random";
  identityPubkey: Buffer;
  createdAt: Date;
}): Peer {
  return {
    id: u.id,
    accountType: u.accountType,
    fingerprint: fingerprintForPublicKey(u.identityPubkey),
    createdAt: u.createdAt.toISOString(),
  };
}

export const connectionsRouter = router({
  listIncoming: protectedProcedure
    .output(z.array(IncomingRequestSchema))
    .query(async ({ ctx }): Promise<IncomingRequest[]> => {
      const db = getDb();
      const rows = await db
        .select({
          req: schema.connectionRequests,
          user: schema.users,
        })
        .from(schema.connectionRequests)
        .innerJoin(
          schema.users,
          eq(schema.users.id, schema.connectionRequests.fromUserId),
        )
        .where(
          and(
            eq(schema.connectionRequests.toUserId, ctx.userId),
            eq(schema.connectionRequests.status, "pending"),
          ),
        )
        .orderBy(desc(schema.connectionRequests.createdAt));
      return rows.map((r) => ({
        id: r.req.id,
        from: peer(r.user),
        note: r.req.note,
        createdAt: r.req.createdAt.toISOString(),
      }));
    }),

  listOutgoing: protectedProcedure
    .output(z.array(OutgoingRequestSchema))
    .query(async ({ ctx }): Promise<OutgoingRequest[]> => {
      const db = getDb();
      const rows = await db
        .select({
          req: schema.connectionRequests,
          user: schema.users,
        })
        .from(schema.connectionRequests)
        .innerJoin(
          schema.users,
          eq(schema.users.id, schema.connectionRequests.toUserId),
        )
        .where(eq(schema.connectionRequests.fromUserId, ctx.userId))
        .orderBy(desc(schema.connectionRequests.createdAt));
      return rows.map((r) => ({
        id: r.req.id,
        to: peer(r.user),
        note: r.req.note,
        status: r.req.status,
        createdAt: r.req.createdAt.toISOString(),
        decidedAt: r.req.decidedAt ? r.req.decidedAt.toISOString() : null,
      }));
    }),

  list: protectedProcedure
    .output(z.array(ConnectionSchema))
    .query(async ({ ctx }): Promise<Connection[]> => {
      const db = getDb();
      const me = ctx.userId;
      const rows = await db
        .select({
          conn: schema.connections,
          a: schema.users,
        })
        .from(schema.connections)
        .innerJoin(
          schema.users,
          or(
            and(
              eq(schema.connections.userAId, me),
              eq(schema.users.id, schema.connections.userBId),
            ),
            and(
              eq(schema.connections.userBId, me),
              eq(schema.users.id, schema.connections.userAId),
            ),
          ),
        )
        .where(
          or(
            eq(schema.connections.userAId, me),
            eq(schema.connections.userBId, me),
          ),
        )
        .orderBy(desc(schema.connections.createdAt));
      return rows.map((r) => ({
        id: r.conn.id,
        peer: peer(r.a),
        createdAt: r.conn.createdAt.toISOString(),
      }));
    }),

  accept: protectedProcedure
    .input(RequestIdInput)
    .output(OkSchema)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const found = await db
        .select()
        .from(schema.connectionRequests)
        .where(
          and(
            eq(schema.connectionRequests.id, input.requestId),
            eq(schema.connectionRequests.toUserId, ctx.userId),
            eq(schema.connectionRequests.status, "pending"),
          ),
        )
        .limit(1);
      const req = found[0];
      if (!req) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Request not found or no longer pending.",
        });
      }

      const [a, b] =
        req.fromUserId < req.toUserId
          ? [req.fromUserId, req.toUserId]
          : [req.toUserId, req.fromUserId];

      await db.transaction(async (tx) => {
        await tx
          .insert(schema.connections)
          .values({ userAId: a, userBId: b })
          .onConflictDoNothing();
        await tx
          .update(schema.connectionRequests)
          .set({ status: "accepted", decidedAt: new Date() })
          .where(eq(schema.connectionRequests.id, req.id));
      });

      return { ok: true as const };
    }),

  reject: protectedProcedure
    .input(RequestIdInput)
    .output(OkSchema)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const updated = await db
        .update(schema.connectionRequests)
        .set({ status: "rejected", decidedAt: new Date() })
        .where(
          and(
            eq(schema.connectionRequests.id, input.requestId),
            eq(schema.connectionRequests.toUserId, ctx.userId),
            eq(schema.connectionRequests.status, "pending"),
          ),
        )
        .returning({ id: schema.connectionRequests.id });
      if (updated.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Request not found or no longer pending.",
        });
      }
      return { ok: true as const };
    }),

  cancel: protectedProcedure
    .input(RequestIdInput)
    .output(OkSchema)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const updated = await db
        .update(schema.connectionRequests)
        .set({ status: "canceled", decidedAt: new Date() })
        .where(
          and(
            eq(schema.connectionRequests.id, input.requestId),
            eq(schema.connectionRequests.fromUserId, ctx.userId),
            eq(schema.connectionRequests.status, "pending"),
          ),
        )
        .returning({ id: schema.connectionRequests.id });
      if (updated.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Request not found or already decided.",
        });
      }
      return { ok: true as const };
    }),

  /**
   * Send a connection request to a peer by user id (no invite token).
   * Used by the contact-discovery flow after a phone-hash match.
   * Idempotent: re-sending while a request is already pending returns ok
   * and reuses the existing row.
   */
  requestByPeerId: protectedProcedure
    .input(
      PeerIdInput.extend({
        note: z.string().trim().max(140).optional(),
      }),
    )
    .output(z.object({ ok: z.literal(true), requestId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const me = ctx.userId;
      const peer = input.peerId;
      if (peer === me) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You can't connect to yourself.",
        });
      }

      const peerExists = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.id, peer))
        .limit(1);
      if (peerExists.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No such user." });
      }

      const [a, b] = me < peer ? [me, peer] : [peer, me];
      const already = await db
        .select({ id: schema.connections.id })
        .from(schema.connections)
        .where(
          and(
            eq(schema.connections.userAId, a),
            eq(schema.connections.userBId, b),
          ),
        )
        .limit(1);
      if (already.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Already connected to this user.",
        });
      }

      const existingPending = await db
        .select({ id: schema.connectionRequests.id })
        .from(schema.connectionRequests)
        .where(
          and(
            eq(schema.connectionRequests.fromUserId, me),
            eq(schema.connectionRequests.toUserId, peer),
            eq(schema.connectionRequests.status, "pending"),
          ),
        )
        .limit(1);
      if (existingPending[0]) {
        return { ok: true as const, requestId: existingPending[0].id };
      }

      const inserted = await db
        .insert(schema.connectionRequests)
        .values({
          fromUserId: me,
          toUserId: peer,
          inviteId: null,
          note: input.note ?? null,
        })
        .returning({ id: schema.connectionRequests.id });
      return { ok: true as const, requestId: inserted[0]!.id };
    }),

  remove: protectedProcedure
    .input(PeerIdInput)
    .output(OkSchema)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const me = ctx.userId;
      const peerId = input.peerId;
      const [a, b] = me < peerId ? [me, peerId] : [peerId, me];
      const deleted = await db
        .delete(schema.connections)
        .where(
          and(
            eq(schema.connections.userAId, a),
            eq(schema.connections.userBId, b),
          ),
        )
        .returning({ id: schema.connections.id });
      if (deleted.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No such connection.",
        });
      }
      return { ok: true as const };
    }),

  /* ─────────── Contact Discovery (Phase 4 — phone accounts) ─────────── */

  getDiscoverySalt: protectedProcedure
    .output(GetDiscoverySaltResult)
    .query(() => {
      pruneExpiredSalts();
      if (!env.IDENTIFIER_HMAC_PEPPER) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "IDENTIFIER_HMAC_PEPPER is not configured.",
        });
      }
      const saltId = randomUUID();
      const salt = createHmac("sha256", env.IDENTIFIER_HMAC_PEPPER)
        .update(`discovery-salt:${saltId}`)
        .digest("base64");
      discoverySalts.set(saltId, {
        salt,
        expiresAt: Date.now() + SALT_TTL_MS,
      });
      return {
        saltId,
        salt,
        expiresInSeconds: Math.floor(SALT_TTL_MS / 1000),
      };
    }),

  discoverContacts: protectedProcedure
    .input(DiscoverContactsInput)
    .output(DiscoverContactsResult)
    .mutation(async ({ input }) => {
      pruneExpiredSalts();
      const saltEntry = discoverySalts.get(input.saltId);
      if (!saltEntry || saltEntry.expiresAt <= Date.now()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Discovery salt expired or not found. Fetch a new one.",
        });
      }

      if (input.hashes.length === 0) {
        return { matches: {} };
      }

      const db = getDb();
      const phoneUsers = await db
        .select({
          id: schema.users.id,
          phoneSha: schema.users.phoneSha,
        })
        .from(schema.users)
        .where(eq(schema.users.accountType, "phone"));

      const wanted = new Set(input.hashes);
      const matches: Record<string, string> = {};

      for (const user of phoneUsers) {
        if (!user.phoneSha) continue;
        const rederived = createHmac("sha256", saltEntry.salt)
          .update(user.phoneSha)
          .digest("base64");
        if (wanted.has(rederived)) {
          matches[rederived] = user.id;
        }
      }

      return { matches };
    }),
});
