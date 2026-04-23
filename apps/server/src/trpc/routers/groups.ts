import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import {
  AddGroupMembersInput,
  CreateGroupInput,
  GroupDetailSchema,
  GroupIdInput,
  GroupSummarySchema,
  RemoveGroupMemberInput,
  SetGroupRoleInput,
  UpdateGroupMetaInput,
  type GroupDetail,
  type GroupSummary,
} from "@veil/shared";
import { z } from "zod";
import { protectedProcedure, router } from "../init.js";
import { getDb, schema } from "../../db/index.js";
import { publish } from "../../lib/wsHub.js";

const GROUP_MEMBER_HARD_CAP = 100;

function fingerprintFromIdentity(pubkey: Buffer | null): string | null {
  if (!pubkey || pubkey.length === 0) return null;
  // Short 8-hex fingerprint xxxx-xxxx, matches client display elsewhere.
  const hex = Buffer.from(pubkey).toString("hex");
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

async function assertConnected(
  db: ReturnType<typeof getDb>,
  me: string,
  peers: string[],
) {
  if (peers.length === 0) return;
  const checks = await Promise.all(
    peers.map(async (peer) => {
      const [a, b] = me < peer ? [me, peer] : [peer, me];
      const rows = await db
        .select({ id: schema.connections.id })
        .from(schema.connections)
        .where(
          and(
            eq(schema.connections.userAId, a),
            eq(schema.connections.userBId, b),
          ),
        )
        .limit(1);
      return { peer, ok: rows.length > 0 };
    }),
  );
  const missing = checks.filter((c) => !c.ok).map((c) => c.peer);
  if (missing.length > 0) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Not connected to ${missing.length} of the selected contacts.`,
    });
  }
}

async function loadMyMembership(
  db: ReturnType<typeof getDb>,
  groupId: string,
  userId: string,
) {
  const rows = await db
    .select()
    .from(schema.groupMembers)
    .where(
      and(
        eq(schema.groupMembers.groupId, groupId),
        eq(schema.groupMembers.userId, userId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

async function bumpEpoch(
  db: ReturnType<typeof getDb>,
  groupId: string,
): Promise<number> {
  const updated = await db
    .update(schema.groups)
    .set({
      epoch: sql`${schema.groups.epoch} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(schema.groups.id, groupId))
    .returning({ epoch: schema.groups.epoch });
  return updated[0]?.epoch ?? 0;
}

async function notifyMembers(
  db: ReturnType<typeof getDb>,
  groupId: string,
  exceptUserId?: string,
) {
  const members = await db
    .select({ userId: schema.groupMembers.userId })
    .from(schema.groupMembers)
    .where(eq(schema.groupMembers.groupId, groupId));
  for (const m of members) {
    if (exceptUserId && m.userId === exceptUserId) continue;
    publish(m.userId, { type: "group_changed", groupId });
  }
}

export const groupsRouter = router({
  /** Create a new group with the caller as admin and the given peers as members. */
  create: protectedProcedure
    .input(CreateGroupInput)
    .output(GroupDetailSchema)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const me = ctx.userId;
      // Dedupe + remove self
      const peers = Array.from(
        new Set(input.memberPeerIds.filter((p) => p !== me)),
      );
      if (peers.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Pick at least one connected contact.",
        });
      }
      if (peers.length + 1 > GROUP_MEMBER_HARD_CAP) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Groups are limited to ${GROUP_MEMBER_HARD_CAP} members.`,
        });
      }
      await assertConnected(db, me, peers);

      const inserted = await db
        .insert(schema.groups)
        .values({
          name: input.name,
          description: input.description ?? null,
          createdByUserId: me,
        })
        .returning();
      const grp = inserted[0]!;

      const rows: Array<{
        groupId: string;
        userId: string;
        role: "admin" | "member";
      }> = [{ groupId: grp.id, userId: me, role: "admin" }];
      for (const p of peers) rows.push({ groupId: grp.id, userId: p, role: "member" });
      await db.insert(schema.groupMembers).values(rows);

      // Notify EVERY member including the creator. The creator's client
      // needs the event so it proactively generates+distributes its
      // sender key for epoch 0 instead of waiting until the first send,
      // which closes the race where another member sends before we do.
      await notifyMembers(db, grp.id);
      return await loadGroupDetail(db, grp.id, me);
    }),

  /** List the groups I'm a member of. */
  list: protectedProcedure
    .output(z.array(GroupSummarySchema))
    .query(async ({ ctx }): Promise<GroupSummary[]> => {
      const db = getDb();
      const myMemberships = await db
        .select({
          groupId: schema.groupMembers.groupId,
          role: schema.groupMembers.role,
        })
        .from(schema.groupMembers)
        .where(eq(schema.groupMembers.userId, ctx.userId));
      if (myMemberships.length === 0) return [];

      const ids = myMemberships.map((m) => m.groupId);
      const grps = await db
        .select()
        .from(schema.groups)
        .where(inArray(schema.groups.id, ids));

      // Count members per group in one query
      const counts = await db
        .select({
          groupId: schema.groupMembers.groupId,
          n: sql<number>`count(*)::int`.as("n"),
        })
        .from(schema.groupMembers)
        .where(inArray(schema.groupMembers.groupId, ids))
        .groupBy(schema.groupMembers.groupId);
      const countMap = new Map(counts.map((c) => [c.groupId, Number(c.n)]));
      const roleMap = new Map(myMemberships.map((m) => [m.groupId, m.role]));

      return grps
        .map((g) => ({
          id: g.id,
          name: g.name,
          description: g.description ?? null,
          epoch: g.epoch,
          myRole: roleMap.get(g.id) ?? "member",
          memberCount: countMap.get(g.id) ?? 0,
          createdAt: g.createdAt.toISOString(),
          updatedAt: g.updatedAt.toISOString(),
        }))
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    }),

  /** Full detail: members + roles + fingerprints. */
  get: protectedProcedure
    .input(GroupIdInput)
    .output(GroupDetailSchema)
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const membership = await loadMyMembership(db, input.groupId, ctx.userId);
      if (!membership) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Group not found." });
      }
      return await loadGroupDetail(db, input.groupId, ctx.userId);
    }),

  /** Admin only: add new members (must be your connections). */
  addMembers: protectedProcedure
    .input(AddGroupMembersInput)
    .output(GroupDetailSchema)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const me = ctx.userId;
      const membership = await loadMyMembership(db, input.groupId, me);
      if (!membership) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Group not found." });
      }
      if (membership.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can add members.",
        });
      }
      const peers = Array.from(new Set(input.peerIds.filter((p) => p !== me)));
      if (peers.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Pick at least one contact to add.",
        });
      }
      await assertConnected(db, me, peers);

      // Filter out already-members
      const existing = await db
        .select({ userId: schema.groupMembers.userId })
        .from(schema.groupMembers)
        .where(eq(schema.groupMembers.groupId, input.groupId));
      const have = new Set(existing.map((e) => e.userId));
      const toAdd = peers.filter((p) => !have.has(p));
      if (toAdd.length === 0) {
        return await loadGroupDetail(db, input.groupId, me);
      }
      if (have.size + toAdd.length > GROUP_MEMBER_HARD_CAP) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Groups are limited to ${GROUP_MEMBER_HARD_CAP} members.`,
        });
      }
      await db.insert(schema.groupMembers).values(
        toAdd.map((u) => ({
          groupId: input.groupId,
          userId: u,
          role: "member" as const,
        })),
      );
      await bumpEpoch(db, input.groupId);
      await notifyMembers(db, input.groupId);
      return await loadGroupDetail(db, input.groupId, me);
    }),

  /** Admin only: remove a member (or yourself, see leave below). */
  removeMember: protectedProcedure
    .input(RemoveGroupMemberInput)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const me = ctx.userId;
      const myMem = await loadMyMembership(db, input.groupId, me);
      if (!myMem) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Group not found." });
      }
      if (input.userId === me) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Use 'leave' to remove yourself.",
        });
      }
      if (myMem.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can remove members.",
        });
      }
      const target = await loadMyMembership(db, input.groupId, input.userId);
      if (!target) return { ok: true as const };
      await db
        .delete(schema.groupMembers)
        .where(
          and(
            eq(schema.groupMembers.groupId, input.groupId),
            eq(schema.groupMembers.userId, input.userId),
          ),
        );
      await bumpEpoch(db, input.groupId);
      await notifyMembers(db, input.groupId);
      // Also notify the removed user so their UI updates.
      publish(input.userId, { type: "group_changed", groupId: input.groupId });
      return { ok: true as const };
    }),

  /** Leave the group. If you were the last admin, promote the oldest member. */
  leave: protectedProcedure
    .input(GroupIdInput)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const me = ctx.userId;
      const myMem = await loadMyMembership(db, input.groupId, me);
      if (!myMem) return { ok: true as const };
      await db
        .delete(schema.groupMembers)
        .where(
          and(
            eq(schema.groupMembers.groupId, input.groupId),
            eq(schema.groupMembers.userId, me),
          ),
        );
      const remaining = await db
        .select()
        .from(schema.groupMembers)
        .where(eq(schema.groupMembers.groupId, input.groupId))
        .orderBy(asc(schema.groupMembers.joinedAt));
      if (remaining.length === 0) {
        // Empty group → delete.
        await db.delete(schema.groups).where(eq(schema.groups.id, input.groupId));
        return { ok: true as const };
      }
      const hasAdmin = remaining.some((m) => m.role === "admin");
      if (!hasAdmin) {
        const oldest = remaining[0]!;
        await db
          .update(schema.groupMembers)
          .set({ role: "admin" })
          .where(eq(schema.groupMembers.id, oldest.id));
      }
      await bumpEpoch(db, input.groupId);
      await notifyMembers(db, input.groupId);
      return { ok: true as const };
    }),

  /**
   * Admin only: force-bump the group epoch so every member redistributes
   * their sender key. Useful as a one-tap recovery if any member's
   * sender key got out of sync (e.g. a missed `group_changed` event).
   */
  rotateKeys: protectedProcedure
    .input(GroupIdInput)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const me = ctx.userId;
      const myMem = await loadMyMembership(db, input.groupId, me);
      if (!myMem) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Group not found." });
      }
      if (myMem.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can re-share encryption keys.",
        });
      }
      const epoch = await bumpEpoch(db, input.groupId);
      await notifyMembers(db, input.groupId);
      return { ok: true as const, epoch };
    }),

  /** Admin only: rename / set description. */
  updateMeta: protectedProcedure
    .input(UpdateGroupMetaInput)
    .output(GroupDetailSchema)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const me = ctx.userId;
      const myMem = await loadMyMembership(db, input.groupId, me);
      if (!myMem) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Group not found." });
      }
      if (myMem.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can edit group info.",
        });
      }
      const patch: { name?: string; description?: string | null; updatedAt: Date } = {
        updatedAt: new Date(),
      };
      if (input.name !== undefined) patch.name = input.name;
      if (input.description !== undefined) patch.description = input.description;
      await db.update(schema.groups).set(patch).where(eq(schema.groups.id, input.groupId));
      await notifyMembers(db, input.groupId);
      return await loadGroupDetail(db, input.groupId, me);
    }),

  /** Admin only: change another member's role. */
  setRole: protectedProcedure
    .input(SetGroupRoleInput)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const me = ctx.userId;
      const myMem = await loadMyMembership(db, input.groupId, me);
      if (!myMem || myMem.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can change roles.",
        });
      }
      if (input.userId === me) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Use 'leave' to step down.",
        });
      }
      const target = await loadMyMembership(db, input.groupId, input.userId);
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found." });
      }
      await db
        .update(schema.groupMembers)
        .set({ role: input.role })
        .where(eq(schema.groupMembers.id, target.id));
      await notifyMembers(db, input.groupId);
      return { ok: true as const };
    }),
});

async function loadGroupDetail(
  db: ReturnType<typeof getDb>,
  groupId: string,
  me: string,
): Promise<GroupDetail> {
  const grpRows = await db
    .select()
    .from(schema.groups)
    .where(eq(schema.groups.id, groupId))
    .limit(1);
  const grp = grpRows[0];
  if (!grp) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Group not found." });
  }
  const memberRows = await db
    .select({
      userId: schema.groupMembers.userId,
      role: schema.groupMembers.role,
      joinedAt: schema.groupMembers.joinedAt,
      identity: schema.users.identityPubkey,
    })
    .from(schema.groupMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.groupMembers.userId))
    .where(eq(schema.groupMembers.groupId, groupId))
    .orderBy(asc(schema.groupMembers.joinedAt));

  const myRole = memberRows.find((m) => m.userId === me)?.role ?? "member";

  return {
    id: grp.id,
    name: grp.name,
    description: grp.description ?? null,
    epoch: grp.epoch,
    myRole,
    memberCount: memberRows.length,
    createdAt: grp.createdAt.toISOString(),
    updatedAt: grp.updatedAt.toISOString(),
    createdByUserId: grp.createdByUserId,
    members: memberRows.map((m) => ({
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
      fingerprint: fingerprintFromIdentity(m.identity as Buffer | null),
    })),
  };
}
