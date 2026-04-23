import { TRPCError } from "@trpc/server";
import { and, eq, desc, gt, lt } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import { randomBytes } from "node:crypto";
import { ed25519 } from "@noble/curves/ed25519.js";
import bcrypt from "bcryptjs";
import {
  RequestEmailOtpInput,
  VerifyEmailOtpInput,
  VerifyFirebasePhoneInput,
  SignupRandomInput,
  RequestRandomChallengeInput,
  RandomChallengeResult,
  LoginRandomInput,
  AuthResultSchema,
  RequestEmailOtpResult,
  IssueBotChallengeResult,
  VerifyBotChallengeInput,
  VerifyBotChallengeResult,
  CheckUsernameInput,
  CheckUsernameResult,
  SignupRandomV2Input,
  LoginRandomV2Input,
  VerifyDailyPasswordInput,
  VerifyDailyPasswordResult,
  SetVerificationPasswordInput,
  SetVerificationPasswordResult,
  type AuthResult,
} from "@veil/shared";
import {
  issueBotChallenge,
  verifyBotChallenge,
  consumeBotToken,
} from "../../lib/botChallenge.js";

/**
 * Reserved usernames we never let users register, regardless of case.
 * Anything routing-related, brand-name, or admin-flavoured.
 */
const RESERVED_USERNAMES = new Set<string>([
  "admin", "administrator", "root", "support", "help", "veil",
  "official", "system", "moderator", "mod", "staff", "team",
  "api", "www", "app", "settings", "login", "logout", "signup",
  "signin", "me", "you", "user", "users", "anonymous", "null",
  "undefined", "everyone", "nobody",
]);
import { configuredProcedure, protectedProcedure, router } from "../init.js";
import { getDb, schema } from "../../db/index.js";
import { hashIdentifier, phoneDiscoverySha, sha256Hex } from "../../lib/hash.js";
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
import {
  isFirebaseConfigured,
  verifyFirebaseIdToken,
} from "../../lib/firebase.js";

const CHALLENGE_TTL_SECONDS = 2 * 60;

function challengeKey(): Uint8Array {
  if (!env.JWT_SECRET) throw new Error("JWT_SECRET missing");
  return new TextEncoder().encode(`challenge:${env.JWT_SECRET}`);
}

const REFRESH_COOKIE_SAMESITE: "none" | "lax" = env.COOKIE_SECURE
  ? "none"
  : "lax";

function setRefreshCookie(
  res: { setCookie: (name: string, value: string, opts: object) => void },
  token: string,
) {
  res.setCookie("veil_refresh", token, {
    path: "/",
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: REFRESH_COOKIE_SAMESITE,
    maxAge: TOKEN_TTL.refreshSeconds,
  });
}

function clearRefreshCookie(res: {
  clearCookie: (name: string, opts: object) => void;
}) {
  res.clearCookie("veil_refresh", {
    path: "/",
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: REFRESH_COOKIE_SAMESITE,
  });
}

async function issueSession(
  ctx: {
    req: { headers: Record<string, string | string[] | undefined> };
    res: unknown;
  },
  userId: string,
  accountType: "email" | "phone" | "random",
  accountCreatedAt: Date,
): Promise<AuthResult> {
  const db = getDb();
  const accessToken = await signAccessToken({ sub: userId });
  const refreshToken = generateRefreshToken();
  const refreshExpires = new Date(
    Date.now() + TOKEN_TTL.refreshSeconds * 1000,
  );
  await db.insert(schema.sessions).values({
    userId,
    refreshTokenHash: sha256Hex(refreshToken),
    deviceLabel:
      (ctx.req.headers["user-agent"] as string | undefined)?.slice(0, 200) ??
      null,
    expiresAt: refreshExpires,
  });
  await db
    .update(schema.users)
    .set({ lastSeenAt: new Date() })
    .where(eq(schema.users.id, userId));

  // Re-read profile fields so the freshly-issued session carries them.
  const profile = await db
    .select({
      username: schema.users.username,
      displayName: schema.users.displayName,
      bio: schema.users.bio,
      avatarDataUrl: schema.users.avatarDataUrl,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  const p = profile[0];

  setRefreshCookie(ctx.res as never, refreshToken);

  return {
    user: {
      id: userId,
      accountType,
      createdAt: accountCreatedAt.toISOString(),
      username: p?.username ?? null,
      displayName: p?.displayName ?? null,
      bio: p?.bio ?? null,
      avatarDataUrl: p?.avatarDataUrl ?? null,
    },
    accessToken,
    refreshToken,
    refreshExpiresIn: TOKEN_TTL.refreshSeconds,
    expiresIn: TOKEN_TTL.accessSeconds,
  };
}

function readRefreshToken(req: {
  headers: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string>;
}): string | null {
  const header = req.headers["x-refresh-token"];
  if (typeof header === "string" && header.length > 0) return header;
  if (Array.isArray(header) && header[0]) return header[0];
  const cookie = req.cookies?.["veil_refresh"];
  return cookie && cookie.length > 0 ? cookie : null;
}

export const authRouter = router({
  /* ─────────── Email OTP ─────────── */

  requestEmailOtp: configuredProcedure
    .input(RequestEmailOtpInput)
    .output(RequestEmailOtpResult)
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const identifierHash = hashIdentifier(input.email);

      const emailLimit = rateLimit({
        key: `otp:email:${identifierHash}`,
        limit: 3,
        windowSeconds: 60 * 60,
      });
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

      if (input.purpose === "login") {
        const existing = await db
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(eq(schema.users.emailHash, identifierHash))
          .limit(1);
        if (existing.length === 0) {
          return { delivered: true, expiresInSeconds: OTP_TTL_SECONDS };
        }
      } else {
        const existing = await db
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(eq(schema.users.emailHash, identifierHash))
          .limit(1);
        if (existing.length > 0) {
          return { delivered: true, expiresInSeconds: OTP_TTL_SECONDS };
        }
      }

      const code = generateOtpCode();
      const codeHash = await hashOtp(code);
      const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

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

      await db
        .update(schema.otpCodes)
        .set({ consumed: true })
        .where(eq(schema.otpCodes.id, otp.id));

      let userId: string;
      let accountCreatedAt: Date;

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
        } catch {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Account already exists for this email. Please log in.",
          });
        }
      } else {
        const found = await db
          .select({ id: schema.users.id, createdAt: schema.users.createdAt })
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
      }

      return issueSession(ctx, userId, "email", accountCreatedAt);
    }),

  /* ─────────── Phone Auth (Firebase) ─────────── */

  verifyFirebasePhone: configuredProcedure
    .input(VerifyFirebasePhoneInput)
    .output(AuthResultSchema)
    .mutation(async ({ input, ctx }): Promise<AuthResult> => {
      if (!isFirebaseConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Firebase is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.",
        });
      }

      let phoneNumber: string;
      try {
        const decoded = await verifyFirebaseIdToken(input.firebaseIdToken);
        if (!decoded.phone_number) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Firebase token does not contain a phone number.",
          });
        }
        phoneNumber = decoded.phone_number;
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid or expired Firebase ID token.",
        });
      }

      const db = getDb();
      const identifierHash = hashIdentifier(phoneNumber);

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

        const existing = await db
          .select({ id: schema.users.id, createdAt: schema.users.createdAt })
          .from(schema.users)
          .where(eq(schema.users.phoneHash, identifierHash))
          .limit(1);

        if (existing.length > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Account already exists for this phone number. Please log in.",
          });
        }

        try {
          const inserted = await db
            .insert(schema.users)
            .values({
              accountType: "phone",
              phoneHash: identifierHash,
              phoneSha: phoneDiscoverySha(phoneNumber),
              identityPubkey: pubkeyBytes,
            })
            .returning({
              id: schema.users.id,
              createdAt: schema.users.createdAt,
            });
          const row = inserted[0]!;
          return issueSession(ctx, row.id, "phone", row.createdAt);
        } catch {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Account already exists for this phone number. Please log in.",
          });
        }
      } else {
        const found = await db
          .select({ id: schema.users.id, createdAt: schema.users.createdAt })
          .from(schema.users)
          .where(eq(schema.users.phoneHash, identifierHash))
          .limit(1);

        if (found.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              "No account found for this phone number. Please sign up first.",
          });
        }
        const row = found[0]!;
        return issueSession(ctx, row.id, "phone", row.createdAt);
      }
    }),

  /* ─────────── Random ID Auth ─────────── */

  signupRandom: configuredProcedure
    .input(SignupRandomInput)
    .output(AuthResultSchema)
    .mutation(async ({ input, ctx }): Promise<AuthResult> => {
      const db = getDb();

      const pubkeyBytes = Buffer.from(input.identityPublicKey, "base64");
      if (pubkeyBytes.length !== 32) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "identityPublicKey must be a 32-byte Ed25519 key.",
        });
      }

      const existing = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.randomId, input.randomId))
        .limit(1);

      if (existing.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This random ID is already taken. Please generate a new one.",
        });
      }

      const inserted = await db
        .insert(schema.users)
        .values({
          accountType: "random",
          randomId: input.randomId,
          identityPubkey: pubkeyBytes,
        })
        .returning({ id: schema.users.id, createdAt: schema.users.createdAt });

      const row = inserted[0]!;
      return issueSession(ctx, row.id, "random", row.createdAt);
    }),

  requestRandomChallenge: configuredProcedure
    .input(RequestRandomChallengeInput)
    .output(RandomChallengeResult)
    .mutation(async ({ input }) => {
      const db = getDb();
      const found = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.randomId, input.randomId))
        .limit(1);

      if (found.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No account found for this ID.",
        });
      }

      const nonce = randomBytes(16).toString("base64url");
      const challenge = await new SignJWT({
        randomId: input.randomId,
        nonce,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(`${CHALLENGE_TTL_SECONDS}s`)
        .sign(challengeKey());

      return { challenge, expiresInSeconds: CHALLENGE_TTL_SECONDS };
    }),

  loginRandom: configuredProcedure
    .input(LoginRandomInput)
    .output(AuthResultSchema)
    .mutation(async ({ input, ctx }): Promise<AuthResult> => {
      const db = getDb();

      let challengePayload: { randomId?: string };
      try {
        const { payload } = await jwtVerify(input.challenge, challengeKey());
        challengePayload = payload as { randomId?: string };
      } catch {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Challenge expired or invalid. Please request a new one.",
        });
      }

      if (challengePayload.randomId !== input.randomId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Challenge mismatch." });
      }

      const found = await db
        .select({
          id: schema.users.id,
          identityPubkey: schema.users.identityPubkey,
          createdAt: schema.users.createdAt,
        })
        .from(schema.users)
        .where(eq(schema.users.randomId, input.randomId))
        .limit(1);

      if (found.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No account found for this ID." });
      }

      const user = found[0]!;

      let valid = false;
      try {
        valid = ed25519.verify(
          Uint8Array.from(Buffer.from(input.signature, "base64")),
          new TextEncoder().encode(input.challenge),
          Uint8Array.from(user.identityPubkey),
        );
      } catch {
        valid = false;
      }

      if (!valid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Signature verification failed. Check your recovery phrase.",
        });
      }

      return issueSession(ctx, user.id, "random", user.createdAt);
    }),

  /* ─────────── Bot challenge (slide-to-verify) ─────────── */

  issueBotChallenge: configuredProcedure
    .output(IssueBotChallengeResult)
    .mutation(async ({ ctx }) => {
      // Light per-IP throttle so one client can't churn through
      // every gap position and brute-force a token.
      const limit = rateLimit({
        key: `bot:issue:${ctx.ip}`,
        limit: 30,
        windowSeconds: 10 * 60,
      });
      if (!limit.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Too many puzzle requests. Try again in ${limit.resetInSeconds}s.`,
        });
      }
      return issueBotChallenge();
    }),

  verifyBotChallenge: configuredProcedure
    .input(VerifyBotChallengeInput)
    .output(VerifyBotChallengeResult)
    .mutation(async ({ input, ctx }) => {
      const limit = rateLimit({
        key: `bot:verify:${ctx.ip}`,
        limit: 60,
        windowSeconds: 10 * 60,
      });
      if (!limit.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Too many attempts. Try again in ${limit.resetInSeconds}s.`,
        });
      }
      return verifyBotChallenge(input.challengeId, input.guessX);
    }),

  /* ─────────── Username / Signup v2 / Login v2 ─────────── */

  checkUsername: configuredProcedure
    .input(CheckUsernameInput)
    .output(CheckUsernameResult)
    .query(async ({ input }) => {
      if (RESERVED_USERNAMES.has(input.username)) {
        return { available: false, reason: "reserved" as const };
      }
      const db = getDb();
      const found = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.username, input.username))
        .limit(1);
      if (found.length > 0) {
        return { available: false, reason: "taken" as const };
      }
      return { available: true };
    }),

  signupRandomV2: configuredProcedure
    .input(SignupRandomV2Input)
    .output(AuthResultSchema)
    .mutation(async ({ input, ctx }): Promise<AuthResult> => {
      const db = getDb();

      const ipLimit = rateLimit({
        key: `signup:ip:${ctx.ip}`,
        limit: 10,
        windowSeconds: 60 * 60,
      });
      if (!ipLimit.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Too many signups. Try again in ${ipLimit.resetInSeconds}s.`,
        });
      }

      if (!consumeBotToken(input.botToken)) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Bot check failed or expired. Please complete the puzzle again.",
        });
      }

      if (RESERVED_USERNAMES.has(input.username)) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "That username is reserved. Please pick another.",
        });
      }

      const pubkeyBytes = Buffer.from(input.identityPublicKey, "base64");
      if (pubkeyBytes.length !== 32) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "identityPublicKey must be a 32-byte Ed25519 key.",
        });
      }

      const existing = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.username, input.username))
        .limit(1);

      if (existing.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "That username is already taken.",
        });
      }

      // Derive a unique random ID from the username so legacy random-ID
      // lookups (and the existing chat / connection plumbing) keep
      // working without a parallel migration. `username:` prefix avoids
      // any collision with the historical 12-character random IDs.
      const derivedRandomId = `username:${input.username}`;

      const passwordHash = await bcrypt.hash(input.password, 12);
      const verificationPasswordHash = await bcrypt.hash(
        input.verificationPassword,
        12,
      );

      const inserted = await db
        .insert(schema.users)
        .values({
          accountType: "random",
          randomId: derivedRandomId,
          username: input.username,
          passwordHash,
          verificationPasswordHash,
          identityPubkey: pubkeyBytes,
        })
        .returning({ id: schema.users.id, createdAt: schema.users.createdAt });

      const row = inserted[0]!;
      return issueSession(ctx, row.id, "random", row.createdAt);
    }),

  loginRandomV2: configuredProcedure
    .input(LoginRandomV2Input)
    .output(AuthResultSchema)
    .mutation(async ({ input, ctx }): Promise<AuthResult> => {
      const db = getDb();

      const ipLimit = rateLimit({
        key: `login:ip:${ctx.ip}`,
        limit: 30,
        windowSeconds: 10 * 60,
      });
      const userLimit = rateLimit({
        key: `login:user:${input.username}`,
        limit: 10,
        windowSeconds: 10 * 60,
      });
      if (!ipLimit.allowed || !userLimit.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many login attempts. Please wait a few minutes.",
        });
      }

      const found = await db
        .select({
          id: schema.users.id,
          createdAt: schema.users.createdAt,
          passwordHash: schema.users.passwordHash,
        })
        .from(schema.users)
        .where(eq(schema.users.username, input.username))
        .limit(1);

      const row = found[0];
      // Use a constant-ish dummy compare when the user doesn't exist so
      // we don't leak account existence via response timing.
      const hash =
        row?.passwordHash ??
        "$2a$12$abcdefghijklmnopqrstuuabcdefghijklmnopqrstuvwxyz012345";
      const ok = await bcrypt.compare(input.password, hash);

      if (!row || !ok) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Wrong username or password.",
        });
      }

      return issueSession(ctx, row.id, "random", row.createdAt);
    }),

  /* ─────────── Daily verification (24h gate) ─────────── */

  verifyDailyPassword: protectedProcedure
    .input(VerifyDailyPasswordInput)
    .output(VerifyDailyPasswordResult)
    .mutation(async ({ input, ctx }) => {
      const userLimit = rateLimit({
        key: `verify-daily:user:${ctx.userId}`,
        limit: 10,
        windowSeconds: 10 * 60,
      });
      if (!userLimit.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many attempts. Please wait a few minutes.",
        });
      }

      const db = getDb();
      const found = await db
        .select({ hash: schema.users.verificationPasswordHash })
        .from(schema.users)
        .where(eq(schema.users.id, ctx.userId))
        .limit(1);
      const hash =
        found[0]?.hash ??
        "$2a$12$abcdefghijklmnopqrstuuabcdefghijklmnopqrstuvwxyz012345";
      const ok = await bcrypt.compare(input.password, hash);
      if (!found[0]?.hash || !ok) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Wrong verification password.",
        });
      }
      return { ok: true, verifiedAt: new Date().toISOString() };
    }),

  setVerificationPassword: protectedProcedure
    .input(SetVerificationPasswordInput)
    .output(SetVerificationPasswordResult)
    .mutation(async ({ input, ctx }) => {
      const userLimit = rateLimit({
        key: `set-verify:user:${ctx.userId}`,
        limit: 5,
        windowSeconds: 10 * 60,
      });
      if (!userLimit.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many attempts. Please wait a few minutes.",
        });
      }

      const db = getDb();
      const found = await db
        .select({ hash: schema.users.verificationPasswordHash })
        .from(schema.users)
        .where(eq(schema.users.id, ctx.userId))
        .limit(1);
      const existing = found[0]?.hash ?? null;

      if (existing) {
        if (!input.currentPassword) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Current verification password is required.",
          });
        }
        const ok = await bcrypt.compare(input.currentPassword, existing);
        if (!ok) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Current verification password is wrong.",
          });
        }
      }

      const newHash = await bcrypt.hash(input.newPassword, 12);
      await db
        .update(schema.users)
        .set({ verificationPasswordHash: newHash })
        .where(eq(schema.users.id, ctx.userId));

      return { ok: true, updatedAt: new Date().toISOString() };
    }),

  /* ─────────── Session management ─────────── */

  refresh: configuredProcedure
    .output(AuthResultSchema)
    .mutation(async ({ ctx }): Promise<AuthResult> => {
      const token = readRefreshToken(
        ctx.req as unknown as {
          headers: Record<string, string | string[] | undefined>;
          cookies?: Record<string, string>;
        },
      );
      if (!token) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "No refresh token." });
      }
      const db = getDb();
      const tokenHash = sha256Hex(token);
      const found = await db
        .select({ session: schema.sessions, user: schema.users })
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
          username: row.user.username ?? null,
          displayName: row.user.displayName ?? null,
          bio: row.user.bio ?? null,
          avatarDataUrl: row.user.avatarDataUrl ?? null,
        },
        accessToken,
        refreshToken: newRefresh,
        refreshExpiresIn: TOKEN_TTL.refreshSeconds,
        expiresIn: TOKEN_TTL.accessSeconds,
      };
    }),

  logout: configuredProcedure.mutation(async ({ ctx }) => {
    const token = readRefreshToken(
      ctx.req as unknown as {
        headers: Record<string, string | string[] | undefined>;
        cookies?: Record<string, string>;
      },
    );
    if (token) {
      const db = getDb();
      await db
        .delete(schema.sessions)
        .where(eq(schema.sessions.refreshTokenHash, sha256Hex(token)));
    }
    clearRefreshCookie(ctx.res as never);
    return { ok: true as const };
  }),

  housekeeping: configuredProcedure.mutation(async () => {
    const db = getDb();
    const now = new Date();
    await db.delete(schema.otpCodes).where(lt(schema.otpCodes.expiresAt, now));
    await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, now));
    return { ok: true as const };
  }),
});
