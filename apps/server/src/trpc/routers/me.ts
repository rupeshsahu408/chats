import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { PublicUserSchema, type PublicUser } from "@veil/shared";
import { protectedProcedure, router } from "../init.js";
import { getDb, schema } from "../../db/index.js";

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
});
