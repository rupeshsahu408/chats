import { TRPCError } from "@trpc/server";
import { and, desc, eq, or } from "drizzle-orm";
import {
  IncomingRequestSchema,
  OutgoingRequestSchema,
  ConnectionSchema,
  PeerIdInput,
  RequestIdInput,
  OkSchema,
  type IncomingRequest,
  type OutgoingRequest,
  type Connection,
  type Peer,
} from "@veil/shared";
import { z } from "zod";
import { protectedProcedure, router } from "../init.js";
import { getDb, schema } from "../../db/index.js";
import { fingerprintForPublicKey } from "../../lib/fingerprint.js";

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
});
