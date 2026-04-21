import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import type { Context } from "./context.js";
import { missingAuthConfig } from "../env.js";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    const cause = error.cause;
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: cause instanceof ZodError ? cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const requireAuthConfig = t.middleware(({ next }) => {
  const missing = missingAuthConfig();
  if (missing.length > 0) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `Server is missing required configuration: ${missing.join(
        ", ",
      )}. See apps/server/.env.example.`,
    });
  }
  return next();
});

export const requireUser = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});

export const configuredProcedure = publicProcedure.use(requireAuthConfig);
export const protectedProcedure = configuredProcedure.use(requireUser);
