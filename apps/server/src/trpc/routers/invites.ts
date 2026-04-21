import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import {
  CreateInviteInput,
  InviteSummarySchema,
  InvitePreviewSchema,
  RedeemInviteInput,
  InviteTokenSchema,
  type InviteSummary,
  type InvitePreview,
} from "@veil/shared";
import { z } from "zod";
import {
  protectedProcedure,
  configuredProcedure,
  router,
} from "../init.js";
import { getDb, schema } from "../../db/index.js";
import { sha256Hex } from "../../lib/hash.js";
import { generateInviteToken, inviteUrlPath } from "../../lib/invites.js";
import { fingerprintForPublicKey } from "../../lib/fingerprint.js";

const MAX_ACTIVE_INVITES_PER_USER = 25;

function summarise(
  row: typeof schema.invites.$inferSelect,
  extra?: { token?: string; url?: string },
): InviteSummary {
  return {
    id: row.id,
    label: row.label,
    maxUses: row.maxUses,
    usedCount: row.usedCount,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    token: extra?.token,
    url: extra?.url,
  };
}

export const invitesRouter = router({
  /** Create a new invite. The plaintext token is returned ONCE. */
  create: protectedProcedure
    .input(CreateInviteInput)
    .output(InviteSummarySchema)
    .mutation(async ({ ctx, input }): Promise<InviteSummary> => {
      const db = getDb();

      // Cap active invites to prevent abuse.
      const active = await db
        .select({ id: schema.invites.id })
        .from(schema.invites)
        .where(
          and(
            eq(schema.invites.inviterUserId, ctx.userId),
            isNull(schema.invites.revokedAt),
          ),
        );
      if (active.length >= MAX_ACTIVE_INVITES_PER_USER) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `You already have ${MAX_ACTIVE_INVITES_PER_USER} active invites. Revoke one first.`,
        });
      }

      const token = generateInviteToken();
      const tokenHash = sha256Hex(token);
      const expiresAt = input.expiresInHours
        ? new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000)
        : null;

      const inserted = await db
        .insert(schema.invites)
        .values({
          inviterUserId: ctx.userId,
          tokenHash,
          label: input.label ?? null,
          maxUses: input.maxUses ?? 0, // 0 = unlimited (only happens when null passed)
          expiresAt,
        })
        .returning();
      const row = inserted[0]!;
      return summarise(row, { token, url: inviteUrlPath(token) });
    }),

  list: protectedProcedure
    .output(z.array(InviteSummarySchema))
    .query(async ({ ctx }): Promise<InviteSummary[]> => {
      const db = getDb();
      const rows = await db
        .select()
        .from(schema.invites)
        .where(eq(schema.invites.inviterUserId, ctx.userId))
        .orderBy(desc(schema.invites.createdAt));
      return rows.map((r) => summarise(r));
    }),

  revoke: protectedProcedure
    .input(z.object({ inviteId: z.string().uuid() }))
    .output(z.object({ ok: z.literal(true) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const updated = await db
        .update(schema.invites)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(schema.invites.id, input.inviteId),
            eq(schema.invites.inviterUserId, ctx.userId),
            isNull(schema.invites.revokedAt),
          ),
        )
        .returning({ id: schema.invites.id });
      if (updated.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invite not found or already revoked.",
        });
      }
      return { ok: true as const };
    }),

  /** Public preview of an invite — does NOT reveal email/phone. */
  preview: configuredProcedure
    .input(z.object({ token: InviteTokenSchema }))
    .output(InvitePreviewSchema)
    .query(async ({ input }): Promise<InvitePreview> => {
      const db = getDb();
      const tokenHash = sha256Hex(input.token);
      const found = await db
        .select({
          invite: schema.invites,
          inviter: schema.users,
        })
        .from(schema.invites)
        .innerJoin(
          schema.users,
          eq(schema.users.id, schema.invites.inviterUserId),
        )
        .where(eq(schema.invites.tokenHash, tokenHash))
        .limit(1);
      const row = found[0];
      if (!row) {
        return {
          inviter: {
            id: "00000000-0000-0000-0000-000000000000",
            accountType: "email",
            fingerprint: "—",
            createdAt: new Date(0).toISOString(),
          },
          state: "not_found",
        };
      }
      const state = inviteState(row.invite);
      return {
        inviter: {
          id: row.inviter.id,
          accountType: row.inviter.accountType,
          fingerprint: fingerprintForPublicKey(row.inviter.identityPubkey),
          createdAt: row.inviter.createdAt.toISOString(),
        },
        state,
      };
    }),

  /**
   * Redeem an invite. Creates a pending connection_request from caller
   * to the inviter. Inviter then accepts/rejects to complete the link.
   */
  redeem: protectedProcedure
    .input(RedeemInviteInput)
    .output(z.object({ requestId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const tokenHash = sha256Hex(input.token);

      const found = await db
        .select()
        .from(schema.invites)
        .where(eq(schema.invites.tokenHash, tokenHash))
        .limit(1);
      const invite = found[0];
      if (!invite) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invite not found.",
        });
      }
      const state = inviteState(invite);
      if (state !== "valid") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Invite is ${state}.`,
        });
      }
      if (invite.inviterUserId === ctx.userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You can't redeem your own invite.",
        });
      }

      // Already connected?
      const [a, b] =
        ctx.userId < invite.inviterUserId
          ? [ctx.userId, invite.inviterUserId]
          : [invite.inviterUserId, ctx.userId];
      const existingConn = await db
        .select({ id: schema.connections.id })
        .from(schema.connections)
        .where(
          and(
            eq(schema.connections.userAId, a),
            eq(schema.connections.userBId, b),
          ),
        )
        .limit(1);
      if (existingConn.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You're already connected with this person.",
        });
      }

      // Already a pending request from me to them?
      const existingReq = await db
        .select({ id: schema.connectionRequests.id })
        .from(schema.connectionRequests)
        .where(
          and(
            eq(schema.connectionRequests.fromUserId, ctx.userId),
            eq(schema.connectionRequests.toUserId, invite.inviterUserId),
            eq(schema.connectionRequests.status, "pending"),
          ),
        )
        .limit(1);
      if (existingReq.length > 0) {
        return { requestId: existingReq[0]!.id };
      }

      const inserted = await db
        .insert(schema.connectionRequests)
        .values({
          fromUserId: ctx.userId,
          toUserId: invite.inviterUserId,
          inviteId: invite.id,
          note: input.note ?? null,
        })
        .returning({ id: schema.connectionRequests.id });

      // Increment used count.
      await db
        .update(schema.invites)
        .set({ usedCount: invite.usedCount + 1 })
        .where(eq(schema.invites.id, invite.id));

      return { requestId: inserted[0]!.id };
    }),
});

function inviteState(
  inv: typeof schema.invites.$inferSelect,
): "valid" | "expired" | "exhausted" | "revoked" | "not_found" {
  if (inv.revokedAt) return "revoked";
  if (inv.expiresAt && inv.expiresAt <= new Date()) return "expired";
  // maxUses === 0 means "unlimited"
  if (inv.maxUses > 0 && inv.usedCount >= inv.maxUses) return "exhausted";
  return "valid";
}
