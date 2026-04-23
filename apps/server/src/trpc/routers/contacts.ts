import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  ContactNameEntrySchema,
  OkSchema,
  SetContactNameInput,
  type ContactNameEntry,
} from "@veil/shared";
import { protectedProcedure, router } from "../init.js";
import { getDb, schema } from "../../db/index.js";

export const contactsRouter = router({
  /** All contact names the caller has saved. */
  list: protectedProcedure
    .output(z.array(ContactNameEntrySchema))
    .query(async ({ ctx }): Promise<ContactNameEntry[]> => {
      const db = getDb();
      const rows = await db
        .select({
          peerId: schema.userContacts.contactUserId,
          customName: schema.userContacts.customName,
          updatedAt: schema.userContacts.updatedAt,
        })
        .from(schema.userContacts)
        .where(eq(schema.userContacts.ownerUserId, ctx.userId));
      return rows.map((r) => ({
        peerId: r.peerId,
        customName: r.customName,
        updatedAt: r.updatedAt.toISOString(),
      }));
    }),

  /** Save (or clear, if customName === null) a private nickname for one peer. */
  set: protectedProcedure
    .input(SetContactNameInput)
    .output(OkSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.peerId === ctx.userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You can't save a nickname for yourself.",
        });
      }
      const db = getDb();

      // Make sure the peer exists so we don't accidentally save a
      // nickname that points at a deleted/imaginary user id.
      const peer = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.id, input.peerId))
        .limit(1);
      if (peer.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found.",
        });
      }

      if (input.customName === null) {
        await db
          .delete(schema.userContacts)
          .where(
            and(
              eq(schema.userContacts.ownerUserId, ctx.userId),
              eq(schema.userContacts.contactUserId, input.peerId),
            ),
          );
        return { ok: true as const };
      }

      const trimmed = input.customName.trim();
      const now = new Date();
      await db
        .insert(schema.userContacts)
        .values({
          ownerUserId: ctx.userId,
          contactUserId: input.peerId,
          customName: trimmed,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            schema.userContacts.ownerUserId,
            schema.userContacts.contactUserId,
          ],
          set: { customName: trimmed, updatedAt: now },
        });
      return { ok: true as const };
    }),
});
