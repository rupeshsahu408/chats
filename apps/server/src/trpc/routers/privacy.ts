import { TRPCError } from "@trpc/server";
import { and, desc, eq, or } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../init.js";
import { getDb, schema } from "../../db/index.js";
import { fingerprintForPublicKey } from "../../lib/fingerprint.js";
import { OkSchema, PeerIdInput, PeerSchema, type Peer } from "@veil/shared";

const ReportReason = z.enum([
  "spam",
  "harassment",
  "impersonation",
  "illegal",
  "other",
]);

const LastSeenPrivacy = z.enum(["everyone", "contacts", "nobody"]);

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

/** True if `me` has blocked `peerId`, OR `peerId` has blocked `me`. */
export async function isBlockedEitherWay(
  meId: string,
  peerId: string,
): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({ id: schema.blocks.id })
    .from(schema.blocks)
    .where(
      or(
        and(
          eq(schema.blocks.blockerUserId, meId),
          eq(schema.blocks.blockedUserId, peerId),
        ),
        and(
          eq(schema.blocks.blockerUserId, peerId),
          eq(schema.blocks.blockedUserId, meId),
        ),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export const privacyRouter = router({
  /* ─────────────── Blocks ─────────────── */

  listBlocked: protectedProcedure
    .output(
      z.array(
        z.object({
          peer: PeerSchema,
          createdAt: z.string(),
        }),
      ),
    )
    .query(async ({ ctx }) => {
      const db = getDb();
      const rows = await db
        .select({ block: schema.blocks, user: schema.users })
        .from(schema.blocks)
        .innerJoin(
          schema.users,
          eq(schema.users.id, schema.blocks.blockedUserId),
        )
        .where(eq(schema.blocks.blockerUserId, ctx.userId))
        .orderBy(desc(schema.blocks.createdAt));
      return rows.map((r) => ({
        peer: peer(r.user),
        createdAt: r.block.createdAt.toISOString(),
      }));
    }),

  block: protectedProcedure
    .input(PeerIdInput)
    .output(OkSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.peerId === ctx.userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You can't block yourself.",
        });
      }
      const db = getDb();
      await db
        .insert(schema.blocks)
        .values({
          blockerUserId: ctx.userId,
          blockedUserId: input.peerId,
        })
        .onConflictDoNothing();
      return { ok: true as const };
    }),

  unblock: protectedProcedure
    .input(PeerIdInput)
    .output(OkSchema)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .delete(schema.blocks)
        .where(
          and(
            eq(schema.blocks.blockerUserId, ctx.userId),
            eq(schema.blocks.blockedUserId, input.peerId),
          ),
        );
      return { ok: true as const };
    }),

  isBlocked: protectedProcedure
    .input(PeerIdInput)
    .output(z.object({ blockedByMe: z.boolean(), blockedMe: z.boolean() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(schema.blocks)
        .where(
          or(
            and(
              eq(schema.blocks.blockerUserId, ctx.userId),
              eq(schema.blocks.blockedUserId, input.peerId),
            ),
            and(
              eq(schema.blocks.blockerUserId, input.peerId),
              eq(schema.blocks.blockedUserId, ctx.userId),
            ),
          ),
        );
      let blockedByMe = false;
      let blockedMe = false;
      for (const r of rows) {
        if (r.blockerUserId === ctx.userId) blockedByMe = true;
        else blockedMe = true;
      }
      return { blockedByMe, blockedMe };
    }),

  /* ─────────────── Reports ─────────────── */

  report: protectedProcedure
    .input(
      z.object({
        peerId: z.string().uuid(),
        reason: ReportReason,
        note: z.string().trim().max(500).optional(),
        alsoBlock: z.boolean().optional(),
      }),
    )
    .output(OkSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.peerId === ctx.userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You can't report yourself.",
        });
      }
      const db = getDb();
      await db.insert(schema.reports).values({
        reporterUserId: ctx.userId,
        reportedUserId: input.peerId,
        reason: input.reason,
        note: input.note ?? null,
      });
      if (input.alsoBlock) {
        await db
          .insert(schema.blocks)
          .values({
            blockerUserId: ctx.userId,
            blockedUserId: input.peerId,
          })
          .onConflictDoNothing();
      }
      return { ok: true as const };
    }),

  /* ─────────────── Last-seen privacy ─────────────── */

  setLastSeenPrivacy: protectedProcedure
    .input(z.object({ value: LastSeenPrivacy }))
    .output(OkSchema)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .update(schema.users)
        .set({ lastSeenPrivacy: input.value })
        .where(eq(schema.users.id, ctx.userId));
      return { ok: true as const };
    }),

  getLastSeenPrivacy: protectedProcedure
    .output(z.object({ value: LastSeenPrivacy }))
    .query(async ({ ctx }) => {
      const db = getDb();
      const rows = await db
        .select({ v: schema.users.lastSeenPrivacy })
        .from(schema.users)
        .where(eq(schema.users.id, ctx.userId))
        .limit(1);
      return { value: (rows[0]?.v ?? "contacts") as z.infer<typeof LastSeenPrivacy> };
    }),
});
