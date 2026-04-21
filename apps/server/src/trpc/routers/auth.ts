import { TRPCError } from "@trpc/server";
import { and, eq, desc, gt, lt } from "drizzle-orm";
import {
  RequestEmailOtpInput,
  VerifyEmailOtpInput,
  AuthResultSchema,
  RequestEmailOtpResult,
  type AuthResult,
} from "@veil/shared";
import { configuredProcedure, router } from "../init.js";
import { getDb, schema } from "../../db/index.js";
import { hashIdentifier, sha256Hex } from "../../lib/hash.js";
import {
  generateOtpCode,
  hashOtp,
  verifyOtp,
  OTP_TTL_SECONDS,
  OTP_MAX_ATTEMPTS,
} from "../../lib/otp.js";
import { sendOtpEmail } from "../../lib/email.js";
import { rateLimit } from "../../lib/rateLimit.js";
import {
  signAccessToken,
  generateRefreshToken,
  TOKEN_TTL,
} from "../../lib/jwt.js";
import { env } from "../../env.js";

function setRefreshCookie(
  res: { setCookie: (name: string, value: string, opts: object) => void },
  token: string,
) {
  res.setCookie("veil_refresh", token, {
    path: "/",
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    maxAge: TOKEN_TTL.refreshSeconds,
  });
}

function clearRefreshCookie(res: {
  clearCookie: (name: string, opts: object) => void;
}) {
  res.clearCookie("veil_refresh", { path: "/" });
}

export const authRouter = router({
  /**
   * Send a 6-digit OTP to the given email. Rate-limited per-email and per-IP.
   * Always succeeds with `delivered: true` from the user's perspective when
   * input is valid (we don't leak whether the account exists).
   */
  requestEmailOtp: configuredProcedure
    .input(RequestEmailOtpInput)
    .output(RateLimitedResultShape())
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const identifierHash = hashIdentifier(input.email);

      // Per-email throttle: 3 OTP requests per hour.
      const emailLimit = rateLimit({
        key: `otp:email:${identifierHash}`,
        limit: 3,
        windowSeconds: 60 * 60,
      });
      // Per-IP throttle: 10 OTP requests per 10 minutes.
      const ipLimit = rateLimit({
        key: `otp:ip:${ctx.ip}`,
        limit: 10,
        windowSeconds: 10 * 60,
      });

      if (!emailLimit.allowed || !ipLimit.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Too many requests. Try again in ${Math.max(
            emailLimit.resetInSeconds,
            ipLimit.resetInSeconds,
          )}s.`,
        });
      }

      // For login, only proceed if a user with this email actually exists.
      // We still return a generic "delivered" response to avoid enumeration.
      if (input.purpose === "login") {
        const existing = await db
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(eq(schema.users.emailHash, identifierHash))
          .limit(1);
        if (existing.length === 0) {
          // Pretend we sent it.
          return {
            delivered: true,
            expiresInSeconds: OTP_TTL_SECONDS,
          };
        }
      } else if (input.purpose === "signup") {
        // For signup, refuse if the email is already registered (with a
        // generic message to keep enumeration cost the same as login).
        const existing = await db
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(eq(schema.users.emailHash, identifierHash))
          .limit(1);
        if (existing.length > 0) {
          return {
            delivered: true,
            expiresInSeconds: OTP_TTL_SECONDS,
          };
        }
      }

      const code = generateOtpCode();
      const codeHash = await hashOtp(code);
      const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

      // Invalidate previous unconsumed codes for this identifier+purpose.
      await db
        .update(schema.otpCodes)
        .set({ consumed: true })
        .where(
          and(
            eq(schema.otpCodes.identifierHash, identifierHash),
            eq(schema.otpCodes.purpose, input.purpose),
            eq(schema.otpCodes.consumed, false),
          ),
        );

      await db.insert(schema.otpCodes).values({
        identifierHash,
        codeHash,
        purpose: input.purpose,
        expiresAt,
      });

      const sent = await sendOtpEmail({
        to: input.email,
        code,
        purpose: input.purpose,
        log: ctx.req.log,
      });

      return {
        delivered: sent.delivered,
        devCode: sent.devCode,
        expiresInSeconds: OTP_TTL_SECONDS,
      };
    }),

  /**
   * Verify the OTP. On signup: create the user, store identity public key.
   * On login: ensure user exists. In both cases, issue an access JWT and
   * an opaque refresh token (set as an HTTP-only cookie).
   */
  verifyEmailOtp: configuredProcedure
    .input(VerifyEmailOtpInput)
    .output(AuthResultSchema)
    .mutation(async ({ input, ctx }): Promise<AuthResult> => {
      const db = getDb();
      const identifierHash = hashIdentifier(input.email);

      const verifyLimit = rateLimit({
        key: `otp:verify:${identifierHash}`,
        limit: OTP_MAX_ATTEMPTS * 2,
        windowSeconds: 10 * 60,
      });
      if (!verifyLimit.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many verification attempts. Please try again later.",
        });
      }

      // Pull the latest unconsumed, unexpired code for this identifier+purpose.
      const now = new Date();
      const candidates = await db
        .select()
        .from(schema.otpCodes)
        .where(
          and(
            eq(schema.otpCodes.identifierHash, identifierHash),
            eq(schema.otpCodes.purpose, input.purpose),
            eq(schema.otpCodes.consumed, false),
            gt(schema.otpCodes.expiresAt, now),
          ),
        )
        .orderBy(desc(schema.otpCodes.createdAt))
        .limit(1);

      const otp = candidates[0];
      if (!otp) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active code. Request a new one.",
        });
      }
      if (otp.attempts >= OTP_MAX_ATTEMPTS) {
        await db
          .update(schema.otpCodes)
          .set({ consumed: true })
          .where(eq(schema.otpCodes.id, otp.id));
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Too many wrong attempts. Request a new code.",
        });
      }

      const ok = await verifyOtp(input.code, otp.codeHash);
      if (!ok) {
        await db
          .update(schema.otpCodes)
          .set({ attempts: otp.attempts + 1 })
          .where(eq(schema.otpCodes.id, otp.id));
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Incorrect code.",
        });
      }

      // Mark consumed.
      await db
        .update(schema.otpCodes)
        .set({ consumed: true })
        .where(eq(schema.otpCodes.id, otp.id));

      let userId: string;
      let accountCreatedAt: Date;
      let accountType: "email";

      if (input.purpose === "signup") {
        if (!input.identityPublicKey) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "identityPublicKey is required for signup.",
          });
        }
        const pubkeyBytes = Buffer.from(input.identityPublicKey, "base64");
        if (pubkeyBytes.length !== 32) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "identityPublicKey must be a 32-byte Ed25519 key.",
          });
        }

        // Race-safe insert: if email already exists, this will fail on the
        // partial unique index. Treat that as "fall through to login".
        try {
          const inserted = await db
            .insert(schema.users)
            .values({
              accountType: "email",
              emailHash: identifierHash,
              identityPubkey: pubkeyBytes,
            })
            .returning({
              id: schema.users.id,
              createdAt: schema.users.createdAt,
            });
          const row = inserted[0]!;
          userId = row.id;
          accountCreatedAt = row.createdAt;
          accountType = "email";
        } catch {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Account already exists for this email. Please log in.",
          });
        }
      } else {
        const found = await db
          .select({
            id: schema.users.id,
            createdAt: schema.users.createdAt,
            accountType: schema.users.accountType,
          })
          .from(schema.users)
          .where(eq(schema.users.emailHash, identifierHash))
          .limit(1);
        if (found.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No account found for this email.",
          });
        }
        const row = found[0]!;
        userId = row.id;
        accountCreatedAt = row.createdAt;
        accountType = "email";
      }

      // Issue tokens.
      const accessToken = await signAccessToken({ sub: userId });
      const refreshToken = generateRefreshToken();
      const refreshExpires = new Date(
        Date.now() + TOKEN_TTL.refreshSeconds * 1000,
      );
      await db.insert(schema.sessions).values({
        userId,
        refreshTokenHash: sha256Hex(refreshToken),
        deviceLabel: ctx.req.headers["user-agent"]?.slice(0, 200) ?? null,
        expiresAt: refreshExpires,
      });

      await db
        .update(schema.users)
        .set({ lastSeenAt: new Date() })
        .where(eq(schema.users.id, userId));

      setRefreshCookie(ctx.res as never, refreshToken);

      return {
        user: {
          id: userId,
          accountType,
          createdAt: accountCreatedAt.toISOString(),
        },
        accessToken,
        expiresIn: TOKEN_TTL.accessSeconds,
      };
    }),

  /** Exchange the refresh-token cookie for a new access token. */
  refresh: configuredProcedure
    .output(AuthResultSchema)
    .mutation(async ({ ctx }): Promise<AuthResult> => {
      const cookies = (ctx.req as unknown as { cookies?: Record<string, string> })
        .cookies;
      const token = cookies?.["veil_refresh"];
      if (!token) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "No refresh token.",
        });
      }
      const db = getDb();
      const tokenHash = sha256Hex(token);
      const found = await db
        .select({
          session: schema.sessions,
          user: schema.users,
        })
        .from(schema.sessions)
        .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
        .where(eq(schema.sessions.refreshTokenHash, tokenHash))
        .limit(1);
      const row = found[0];
      if (!row || row.session.expiresAt <= new Date()) {
        clearRefreshCookie(ctx.res as never);
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Refresh token invalid or expired.",
        });
      }

      // Rotate.
      const newRefresh = generateRefreshToken();
      const newExpires = new Date(
        Date.now() + TOKEN_TTL.refreshSeconds * 1000,
      );
      await db
        .update(schema.sessions)
        .set({
          refreshTokenHash: sha256Hex(newRefresh),
          lastUsedAt: new Date(),
          expiresAt: newExpires,
        })
        .where(eq(schema.sessions.id, row.session.id));

      const accessToken = await signAccessToken({ sub: row.user.id });
      setRefreshCookie(ctx.res as never, newRefresh);

      return {
        user: {
          id: row.user.id,
          accountType: row.user.accountType,
          createdAt: row.user.createdAt.toISOString(),
        },
        accessToken,
        expiresIn: TOKEN_TTL.accessSeconds,
      };
    }),

  /** Invalidate the current refresh token. */
  logout: configuredProcedure.mutation(async ({ ctx }) => {
    const cookies = (ctx.req as unknown as { cookies?: Record<string, string> })
      .cookies;
    const token = cookies?.["veil_refresh"];
    if (token) {
      const db = getDb();
      await db
        .delete(schema.sessions)
        .where(eq(schema.sessions.refreshTokenHash, sha256Hex(token)));
    }
    clearRefreshCookie(ctx.res as never);
    return { ok: true as const };
  }),

  /** Periodic cleanup helper (callable manually, e.g. from a cron). */
  housekeeping: configuredProcedure.mutation(async () => {
    const db = getDb();
    const now = new Date();
    await db.delete(schema.otpCodes).where(lt(schema.otpCodes.expiresAt, now));
    await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, now));
    return { ok: true as const };
  }),
});

function RateLimitedResultShape() {
  return RequestEmailOtpResult;
}
