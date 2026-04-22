import { eq, and } from "drizzle-orm";
import {
  PushPublicKeyResult,
  SubscribePushInput,
  UnsubscribePushInput,
  OkSchema,
} from "@veil/shared";
import { protectedProcedure, publicProcedure, router } from "../init.js";
import { getDb, schema } from "../../db/index.js";
import { getPublicKey } from "../../lib/push.js";

export const pushRouter = router({
  publicKey: publicProcedure
    .output(PushPublicKeyResult)
    .query(() => ({ publicKey: getPublicKey() })),

  subscribe: protectedProcedure
    .input(SubscribePushInput)
    .output(OkSchema)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      // Replace any existing row for this endpoint (handles the case
      // where the same browser re-registers under a different account).
      await db
        .delete(schema.pushSubscriptions)
        .where(eq(schema.pushSubscriptions.endpoint, input.endpoint));
      await db.insert(schema.pushSubscriptions).values({
        userId: ctx.userId,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent ?? null,
      });
      return { ok: true as const };
    }),

  unsubscribe: protectedProcedure
    .input(UnsubscribePushInput)
    .output(OkSchema)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .delete(schema.pushSubscriptions)
        .where(
          and(
            eq(schema.pushSubscriptions.endpoint, input.endpoint),
            eq(schema.pushSubscriptions.userId, ctx.userId),
          ),
        );
      return { ok: true as const };
    }),
});
