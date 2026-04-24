import { TRPCError } from "@trpc/server";
import { and, eq, desc, gt, lt, ne, isNull, inArray } from "drizzle-orm";
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
  ChangePasswordInput,
  ChangePasswordResult,
  BeginLoginV2Input,
  BeginLoginV2Result,
  CompleteLoginV2Input,
  CompleteLoginV2Result,
  LastLoginInfoResult,
  ListSessionsResult,
  RevokeSessionInput,
  RevokeSessionResult,
  BeginLoginV3Input,
  BeginLoginV3Result,
  PollLoginConflictInput,
  PollLoginConflictResult,
  CompleteAfterApprovalInput,
  CompleteAfterApprovalResult,
  ListPendingLoginRequestsResult,
  ResolveLoginRequestInput,
  ResolveLoginRequestResult,
  ListSecurityAlertsResult,
  AcknowledgeSecurityAlertInput,
  AcknowledgeSecurityAlertResult,
  CheckSessionStatusResult,
  SubmitNewPasswordAfterSecureInput,
  SubmitNewPasswordAfterSecureResult,
  type AuthResult,
  type LoginContextInfo,
} from "@veil/shared";
import {
  classifyRisk,
  ipPrefix,
  deviceFingerprint,
  deviceLabel as describeDevice,
  checkLockout,
  recordFailure,
  clearFailures,
  issueLoginChallenge,
  consumeLoginChallenge,
  lookupCity,
} from "../../lib/loginRisk.js";
import {
  mintContinuationNonce,
  verifyContinuationNonce,
  continuationTtlSeconds,
  mintMustChangeToken,
  verifyMustChangeToken,
  hashNonce,
} from "../../lib/sessionConflicts.js";
import { publish as wsPublish } from "../../lib/wsHub.js";
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

/**
 * Read the user's most-recent prior session and turn it into a
 * friendly "last sign-in from <city>, <device>" payload. Returns null
 * when this is the user's first sign-in (no prior session row).
 */
async function buildLastLoginInfo(
  userId: string,
): Promise<LoginContextInfo | null> {
  const db = getDb();
  const rows = await db
    .select({
      city: schema.sessions.lastCity,
      country: schema.sessions.lastCountry,
      deviceLabel: schema.sessions.deviceLabel,
      createdAt: schema.sessions.createdAt,
    })
    .from(schema.sessions)
    .where(eq(schema.sessions.userId, userId))
    .orderBy(desc(schema.sessions.createdAt))
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  return {
    city: r.city ?? null,
    country: r.country ?? null,
    device: describeDevice(r.deviceLabel),
    at: r.createdAt.toISOString(),
  };
}

/**
 * Variant of `issueSession` that captures device fingerprint, network
 * prefix and a coarse city for the new session row (used by the
 * premium login flow). Also returns the *previous* session's context
 * so the client can render "Last sign-in from …" after a successful
 * login.
 */
async function issueSessionWithContext(
  ctx: {
    req: { headers: Record<string, string | string[] | undefined> };
    res: unknown;
    ip: string;
  },
  userId: string,
  accountType: "email" | "phone" | "random",
  accountCreatedAt: Date,
): Promise<{
  auth: AuthResult;
  lastLogin: LoginContextInfo | null;
  newSessionId: string;
}> {
  const lastLogin = await buildLastLoginInfo(userId);

  const db = getDb();
  const accessToken = await signAccessToken({ sub: userId });
  const refreshToken = generateRefreshToken();
  const refreshExpires = new Date(
    Date.now() + TOKEN_TTL.refreshSeconds * 1000,
  );

  const ua =
    (ctx.req.headers["user-agent"] as string | undefined)?.slice(0, 200) ??
    null;
  const prefix = ipPrefix(ctx.ip);
  const geo = await lookupCity(ctx.ip);

  const inserted = await db
    .insert(schema.sessions)
    .values({
      userId,
      refreshTokenHash: sha256Hex(refreshToken),
      deviceLabel: ua,
      ipPrefix: prefix,
      lastCity: geo.city,
      lastCountry: geo.country,
      expiresAt: refreshExpires,
    })
    .returning({ id: schema.sessions.id });
  const newSessionId = inserted[0]!.id;
  await db
    .update(schema.users)
    .set({ lastSeenAt: new Date() })
    .where(eq(schema.users.id, userId));

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
    auth: {
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
    },
    lastLogin,
    newSessionId,
  };
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

  /**
   * Change the account's login password (the one used at sign-in).
   * Requires the current password to match. Only available for
   * accounts that signed up with username + password — accounts that
   * use email/phone OTP or recovery-phrase signing have no password
   * to change.
   */
  changePassword: protectedProcedure
    .input(ChangePasswordInput)
    .output(ChangePasswordResult)
    .mutation(async ({ input, ctx }) => {
      const userLimit = rateLimit({
        key: `change-password:user:${ctx.userId}`,
        limit: 5,
        windowSeconds: 10 * 60,
      });
      if (!userLimit.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many attempts. Please wait a few minutes.",
        });
      }

      if (input.currentPassword === input.newPassword) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "New password must be different from the current password.",
        });
      }

      const db = getDb();
      const found = await db
        .select({ hash: schema.users.passwordHash })
        .from(schema.users)
        .where(eq(schema.users.id, ctx.userId))
        .limit(1);

      const existing = found[0]?.hash ?? null;
      if (!existing) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "This account does not use a login password. Sign-in is via email, phone, or your recovery phrase.",
        });
      }

      const ok = await bcrypt.compare(input.currentPassword, existing);
      if (!ok) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Current password is incorrect.",
        });
      }

      const newHash = await bcrypt.hash(input.newPassword, 12);
      await db
        .update(schema.users)
        .set({ passwordHash: newHash })
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
    // Mark expired login conflicts as such (so the new device polling
    // them gets a clean "expired" answer instead of waiting forever).
    await db
      .update(schema.loginConflicts)
      .set({ status: "expired", resolvedAt: now })
      .where(
        and(
          eq(schema.loginConflicts.status, "pending"),
          lt(schema.loginConflicts.expiresAt, now),
        ),
      );
    return { ok: true as const };
  }),

  /* ─────────── Single-active-session login (V3) ─────────── */

  /**
   * Replacement for `beginLoginV2`. After a successful password
   * check, decides between four outcomes — see `BeginLoginV3Result`.
   *
   * Single-active-session semantics: if the user already has at least
   * one active session whose `(deviceFingerprint, ipPrefix)` doesn't
   * match the requester, we park the login as a `loginConflicts` row
   * and notify the existing devices via WS. The new device then
   * polls and, on approval, claims the session via
   * `auth.completeAfterApproval`. A re-login from the same browser
   * (matching fingerprint + network) is treated as a same-device
   * refresh and proceeds without confirmation.
   */
  beginLoginV3: configuredProcedure
    .input(BeginLoginV3Input)
    .output(BeginLoginV3Result)
    .mutation(async ({ input, ctx }): Promise<BeginLoginV3Result> => {
      const db = getDb();

      const lockout = checkLockout(input.username, ctx.ip);
      if (lockout.blocked) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Too many attempts. Please try again in ${Math.ceil(
            lockout.retryInSeconds / 60,
          )} minute${lockout.retryInSeconds >= 120 ? "s" : ""}.`,
        });
      }

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
          requirePasswordChange: schema.users.requirePasswordChange,
        })
        .from(schema.users)
        .where(eq(schema.users.username, input.username))
        .limit(1);
      const row = found[0];

      const hash =
        row?.passwordHash ??
        "$2a$12$abcdefghijklmnopqrstuuabcdefghijklmnopqrstuvwxyz012345";
      const ok = await bcrypt.compare(input.password, hash);

      if (!row || !ok) {
        const after = recordFailure(input.username, ctx.ip);
        if (after.blocked) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `Too many attempts. Please try again in ${Math.ceil(
              after.retryInSeconds / 60,
            )} minutes.`,
          });
        }
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Wrong username or password.",
        });
      }

      // Account previously secured → must change password before
      // any session is issued. Don't surface failure counters; this
      // is the legitimate user.
      if (row.requirePasswordChange) {
        clearFailures(input.username, ctx.ip);
        const { token, expiresInSeconds } = mintMustChangeToken(row.id);
        return {
          status: "mustChangePassword",
          mustChangeToken: token,
          expiresInSeconds,
        };
      }

      // Snapshot of currently active sessions for the user.
      const now = new Date();
      const activeSessions = await db
        .select({
          id: schema.sessions.id,
          ipPrefix: schema.sessions.ipPrefix,
          deviceLabel: schema.sessions.deviceLabel,
          lastCity: schema.sessions.lastCity,
          lastCountry: schema.sessions.lastCountry,
          lastUsedAt: schema.sessions.lastUsedAt,
        })
        .from(schema.sessions)
        .where(
          and(
            eq(schema.sessions.userId, row.id),
            gt(schema.sessions.expiresAt, now),
          ),
        )
        .orderBy(desc(schema.sessions.lastUsedAt))
        .limit(20);

      const ua =
        (ctx.req.headers["user-agent"] as string | undefined) ?? null;
      const requesterFp = deviceFingerprint(ua);
      const requesterPrefix = ipPrefix(ctx.ip);

      const sameDeviceMatch = activeSessions.some(
        (s) =>
          deviceFingerprint(s.deviceLabel) === requesterFp &&
          s.ipPrefix === requesterPrefix &&
          requesterFp !== "unknown" &&
          requesterPrefix !== null,
      );

      if (activeSessions.length > 0 && !sameDeviceMatch) {
        // Supersede any pre-existing pending conflict (most recent one
        // wins; old continuation nonces become unusable). This avoids
        // a single attacker spamming multiple confirm prompts.
        const existing = await db
          .select({ id: schema.loginConflicts.id })
          .from(schema.loginConflicts)
          .where(
            and(
              eq(schema.loginConflicts.userId, row.id),
              eq(schema.loginConflicts.status, "pending"),
              gt(schema.loginConflicts.expiresAt, now),
            ),
          );
        if (existing.length > 0) {
          await db
            .update(schema.loginConflicts)
            .set({ status: "expired", resolvedAt: now })
            .where(
              inArray(
                schema.loginConflicts.id,
                existing.map((e) => e.id),
              ),
            );
          for (const e of existing) {
            wsPublish(row.id, {
              type: "login_request_resolved",
              conflictId: e.id,
              decision: "expired",
            });
          }
        }

        const minted = mintContinuationNonce(row.id);
        const geo = await lookupCity(ctx.ip);
        const requesterDevice = describeDevice(ua);
        const inserted = await db
          .insert(schema.loginConflicts)
          .values({
            userId: row.id,
            status: "pending",
            requesterIp: requesterPrefix,
            requesterDevice,
            requesterCity: geo.city,
            requesterCountry: geo.country,
            expiresAt: minted.expiresAt,
            continuationNonceHash: minted.hash,
          })
          .returning({ id: schema.loginConflicts.id });
        const conflictId = inserted[0]!.id;

        wsPublish(row.id, {
          type: "login_request_pending",
          conflictId,
          device: requesterDevice,
          city: geo.city,
          country: geo.country,
          expiresAt: minted.expiresAt.toISOString(),
        });

        const top = activeSessions[0]!;
        clearFailures(input.username, ctx.ip);
        return {
          status: "deviceConflict",
          conflictId,
          continuationNonce: minted.nonce,
          expiresInSeconds: continuationTtlSeconds(),
          existingDevice: describeDevice(top.deviceLabel),
          existingCity: top.lastCity ?? null,
          existingCountry: top.lastCountry ?? null,
        };
      }

      // No conflict — fall through to normal risk-based decision.
      // Use the last 20 sessions ever (active or expired) as "known"
      // devices for the risk model, so a returning user on a familiar
      // browser doesn't get a puzzle just because their last session
      // happened to expire.
      const historicalSessions = await db
        .select({
          ipPrefix: schema.sessions.ipPrefix,
          deviceLabel: schema.sessions.deviceLabel,
        })
        .from(schema.sessions)
        .where(eq(schema.sessions.userId, row.id))
        .orderBy(desc(schema.sessions.createdAt))
        .limit(20);
      const risk = classifyRisk({
        knownDevices: historicalSessions,
        ip: ctx.ip,
        userAgent: ua,
        failuresInWindow: checkLockout(input.username, ctx.ip).failuresInWindow,
      });

      if (risk.level === "low") {
        clearFailures(input.username, ctx.ip);
        // Same-device match → silently terminate the matching old
        // session(s) so we still hold the "single active session"
        // invariant.
        if (sameDeviceMatch) {
          await db
            .delete(schema.sessions)
            .where(
              and(
                eq(schema.sessions.userId, row.id),
                gt(schema.sessions.expiresAt, now),
              ),
            );
        }
        const issued = await issueSessionWithContext(
          ctx,
          row.id,
          "random",
          row.createdAt,
        );
        return {
          status: "ok",
          lastLogin: issued.lastLogin,
          ...issued.auth,
        };
      }

      const challenge = issueLoginChallenge(row.id, ctx.ip, ua);
      return {
        status: "challenge",
        risk: risk.level,
        reasons: risk.reasons,
        challengeNonce: challenge.nonce,
        challengeExpiresInSeconds: challenge.expiresInSeconds,
      };
    }),

  /**
   * The new device polls this endpoint every few seconds while the
   * user is deciding on the existing device. Status only ever
   * transitions forward (pending → accepted | rejected | expired);
   * we never reset to pending.
   */
  pollLoginConflict: configuredProcedure
    .input(PollLoginConflictInput)
    .output(PollLoginConflictResult)
    .query(async ({ input }) => {
      const verified = verifyContinuationNonce(input.continuationNonce);
      if (!verified) {
        return { status: "expired" };
      }
      const db = getDb();
      const rows = await db
        .select({
          status: schema.loginConflicts.status,
          expiresAt: schema.loginConflicts.expiresAt,
        })
        .from(schema.loginConflicts)
        .where(
          and(
            eq(schema.loginConflicts.id, input.conflictId),
            eq(schema.loginConflicts.continuationNonceHash, verified.hash),
            eq(schema.loginConflicts.userId, verified.userId),
          ),
        )
        .limit(1);
      const r = rows[0];
      if (!r) return { status: "expired" };
      const now = Date.now();
      if (r.status === "pending") {
        if (r.expiresAt.getTime() <= now) return { status: "expired" };
        return {
          status: "pending",
          expiresInSeconds: Math.max(
            0,
            Math.floor((r.expiresAt.getTime() - now) / 1000),
          ),
        };
      }
      if (r.status === "accepted") return { status: "accepted" };
      if (r.status === "rejected") return { status: "rejected" };
      return { status: "expired" };
    }),

  /**
   * Final step on the new device — exchange the continuation nonce
   * for a fresh session. Atomically deletes every other active
   * session for the user to enforce single-active-session, and
   * publishes `session_revoked` so any still-connected old device
   * tears down its UI immediately.
   */
  completeAfterApproval: configuredProcedure
    .input(CompleteAfterApprovalInput)
    .output(CompleteAfterApprovalResult)
    .mutation(async ({ input, ctx }) => {
      const verified = verifyContinuationNonce(input.continuationNonce);
      if (!verified) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Sign-in attempt expired. Please start over.",
        });
      }
      const db = getDb();
      const now = new Date();
      const rows = await db
        .select({
          id: schema.loginConflicts.id,
          status: schema.loginConflicts.status,
          consumedAt: schema.loginConflicts.consumedAt,
          expiresAt: schema.loginConflicts.expiresAt,
        })
        .from(schema.loginConflicts)
        .where(
          and(
            eq(schema.loginConflicts.continuationNonceHash, verified.hash),
            eq(schema.loginConflicts.userId, verified.userId),
          ),
        )
        .limit(1);
      const conflict = rows[0];
      if (
        !conflict ||
        conflict.consumedAt !== null ||
        conflict.expiresAt.getTime() <= now.getTime()
      ) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "This sign-in is no longer valid. Please start over.",
        });
      }
      if (conflict.status !== "accepted") {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message:
            conflict.status === "rejected"
              ? "The other device declined this sign-in."
              : "Still waiting for the other device.",
        });
      }

      const userRow = await db
        .select({
          id: schema.users.id,
          createdAt: schema.users.createdAt,
          accountType: schema.users.accountType,
        })
        .from(schema.users)
        .where(eq(schema.users.id, verified.userId))
        .limit(1);
      const user = userRow[0];
      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Account no longer exists.",
        });
      }

      // Mark the conflict consumed BEFORE issuing the new session
      // (so a network retry can't double-issue).
      await db
        .update(schema.loginConflicts)
        .set({ consumedAt: now })
        .where(eq(schema.loginConflicts.id, conflict.id));

      const issued = await issueSessionWithContext(
        ctx,
        user.id,
        user.accountType,
        user.createdAt,
      );

      // Sweep every other active session and notify them via WS.
      const deleted = await db
        .delete(schema.sessions)
        .where(
          and(
            eq(schema.sessions.userId, user.id),
            ne(schema.sessions.id, issued.newSessionId),
          ),
        )
        .returning({ id: schema.sessions.id });
      if (deleted.length > 0) {
        wsPublish(user.id, {
          type: "session_revoked",
          reason: "single_active",
        });
      }

      return {
        ...issued.auth,
        lastLogin: issued.lastLogin,
        replacedSessions: deleted.length,
      };
    }),

  /**
   * Fallback poll for the *existing* device — returns any unresolved
   * inbound login requests so we can show the prompt even if the WS
   * event was missed (page just opened, etc.).
   */
  listPendingLoginRequests: protectedProcedure
    .output(ListPendingLoginRequestsResult)
    .query(async ({ ctx }) => {
      const db = getDb();
      const now = new Date();
      const rows = await db
        .select({
          id: schema.loginConflicts.id,
          requesterDevice: schema.loginConflicts.requesterDevice,
          requesterCity: schema.loginConflicts.requesterCity,
          requesterCountry: schema.loginConflicts.requesterCountry,
          createdAt: schema.loginConflicts.createdAt,
          expiresAt: schema.loginConflicts.expiresAt,
        })
        .from(schema.loginConflicts)
        .where(
          and(
            eq(schema.loginConflicts.userId, ctx.userId),
            eq(schema.loginConflicts.status, "pending"),
            gt(schema.loginConflicts.expiresAt, now),
          ),
        )
        .orderBy(desc(schema.loginConflicts.createdAt))
        .limit(5);
      return rows.map((r) => ({
        id: r.id,
        device: r.requesterDevice ?? "Unknown device",
        city: r.requesterCity ?? null,
        country: r.requesterCountry ?? null,
        createdAt: r.createdAt.toISOString(),
        expiresAt: r.expiresAt.toISOString(),
      }));
    }),

  /**
   * Existing-device decision: accept (the other device will be
   * allowed in, this device gets logged out) or reject (the other
   * device is denied, a security alert is recorded so the user can
   * later choose "It was me" vs "Secure account").
   */
  resolveLoginRequest: protectedProcedure
    .input(ResolveLoginRequestInput)
    .output(ResolveLoginRequestResult)
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const now = new Date();
      const rows = await db
        .select({
          id: schema.loginConflicts.id,
          status: schema.loginConflicts.status,
          expiresAt: schema.loginConflicts.expiresAt,
          requesterDevice: schema.loginConflicts.requesterDevice,
          requesterCity: schema.loginConflicts.requesterCity,
          requesterCountry: schema.loginConflicts.requesterCountry,
        })
        .from(schema.loginConflicts)
        .where(
          and(
            eq(schema.loginConflicts.id, input.conflictId),
            eq(schema.loginConflicts.userId, ctx.userId),
          ),
        )
        .limit(1);
      const conflict = rows[0];
      if (!conflict) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That sign-in request no longer exists.",
        });
      }
      if (conflict.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This request has already been handled.",
        });
      }
      if (conflict.expiresAt.getTime() <= now.getTime()) {
        await db
          .update(schema.loginConflicts)
          .set({ status: "expired", resolvedAt: now })
          .where(eq(schema.loginConflicts.id, conflict.id));
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This request has expired. Ask the other device to try again.",
        });
      }

      const newStatus = input.decision === "accept" ? "accepted" : "rejected";
      await db
        .update(schema.loginConflicts)
        .set({ status: newStatus, resolvedAt: now })
        .where(eq(schema.loginConflicts.id, conflict.id));

      // Notify all the user's connected sockets (this tab + any
      // other tabs of the existing device) so the modal closes
      // everywhere.
      wsPublish(ctx.userId, {
        type: "login_request_resolved",
        conflictId: conflict.id,
        decision: input.decision,
      });

      if (input.decision === "reject") {
        // Persist a security alert so the user can later choose
        // "It was me" or "Secure account" if they want to escalate.
        const inserted = await db
          .insert(schema.securityAlerts)
          .values({
            userId: ctx.userId,
            kind: "rejected_login_attempt",
            payload: {
              device: conflict.requesterDevice,
              city: conflict.requesterCity,
              country: conflict.requesterCountry,
              at: now.toISOString(),
            },
          })
          .returning({ id: schema.securityAlerts.id });
        wsPublish(ctx.userId, {
          type: "security_alert",
          alertId: inserted[0]!.id,
          kind: "rejected_login_attempt",
        });
      }

      return { ok: true as const, decision: input.decision };
    }),

  /** All unacknowledged security alerts for the current user. */
  listSecurityAlerts: protectedProcedure
    .output(ListSecurityAlertsResult)
    .query(async ({ ctx }) => {
      const db = getDb();
      const rows = await db
        .select({
          id: schema.securityAlerts.id,
          kind: schema.securityAlerts.kind,
          payload: schema.securityAlerts.payload,
          createdAt: schema.securityAlerts.createdAt,
        })
        .from(schema.securityAlerts)
        .where(
          and(
            eq(schema.securityAlerts.userId, ctx.userId),
            isNull(schema.securityAlerts.acknowledgedAt),
          ),
        )
        .orderBy(desc(schema.securityAlerts.createdAt))
        .limit(20);
      return rows.map((r) => {
        const p = (r.payload ?? {}) as {
          device?: string | null;
          city?: string | null;
          country?: string | null;
          at?: string | null;
        };
        const kind: "rejected_login_attempt" | "account_secured" =
          r.kind === "account_secured"
            ? "account_secured"
            : "rejected_login_attempt";
        return {
          id: r.id,
          kind,
          device: p.device ?? null,
          city: p.city ?? null,
          country: p.country ?? null,
          at: p.at ?? r.createdAt.toISOString(),
          createdAt: r.createdAt.toISOString(),
        };
      });
    }),

  /**
   * Acknowledge a security alert.
   *
   *   - "dismiss" — user confirms it was them; just clear the alert.
   *   - "secure"  — sign out everywhere, set `requirePasswordChange`,
   *                 and record an `account_secured` alert as a
   *                 self-audit trail.
   */
  acknowledgeSecurityAlert: protectedProcedure
    .input(AcknowledgeSecurityAlertInput)
    .output(AcknowledgeSecurityAlertResult)
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const now = new Date();
      const rows = await db
        .select({ id: schema.securityAlerts.id })
        .from(schema.securityAlerts)
        .where(
          and(
            eq(schema.securityAlerts.id, input.alertId),
            eq(schema.securityAlerts.userId, ctx.userId),
          ),
        )
        .limit(1);
      if (!rows[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That security alert no longer exists.",
        });
      }
      await db
        .update(schema.securityAlerts)
        .set({ acknowledgedAt: now })
        .where(eq(schema.securityAlerts.id, input.alertId));

      if (input.action === "secure") {
        // Force re-auth + new password on next login.
        await db
          .update(schema.users)
          .set({ requirePasswordChange: true })
          .where(eq(schema.users.id, ctx.userId));
        await db
          .delete(schema.sessions)
          .where(eq(schema.sessions.userId, ctx.userId));
        await db.insert(schema.securityAlerts).values({
          userId: ctx.userId,
          kind: "account_secured",
          payload: { at: now.toISOString() },
        });
        wsPublish(ctx.userId, {
          type: "session_revoked",
          reason: "secured",
        });
      }

      return { ok: true as const, action: input.action };
    }),

  /**
   * Lightweight liveness check used by the SessionGuard on the
   * client. Tells the caller whether their refresh-cookie session
   * still exists server-side. Public on purpose — when a client is
   * being force-logged-out their access token is still valid for
   * up to 5 minutes, so we can't gate this behind protectedProcedure.
   */
  checkSessionStatus: configuredProcedure
    .output(CheckSessionStatusResult)
    .query(async ({ ctx }) => {
      const token = readRefreshToken(
        ctx.req as unknown as {
          headers: Record<string, string | string[] | undefined>;
          cookies?: Record<string, string>;
        },
      );
      if (!token) return { active: false, reason: "no_cookie" };
      const db = getDb();
      const rows = await db
        .select({ id: schema.sessions.id, expiresAt: schema.sessions.expiresAt })
        .from(schema.sessions)
        .where(eq(schema.sessions.refreshTokenHash, sha256Hex(token)))
        .limit(1);
      const r = rows[0];
      if (!r || r.expiresAt <= new Date()) {
        return { active: false, reason: "revoked" };
      }
      return { active: true, reason: "ok" };
    }),

  /**
   * Redeem the must-change-password token and start fresh — sets a
   * new password, clears `requirePasswordChange`, and issues a
   * session in one shot. Sessions for this user are still all gone
   * from the prior "Secure account" action, so this is the first
   * session post-recovery.
   */
  submitNewPasswordAfterSecure: configuredProcedure
    .input(SubmitNewPasswordAfterSecureInput)
    .output(SubmitNewPasswordAfterSecureResult)
    .mutation(async ({ input, ctx }) => {
      const userId = verifyMustChangeToken(input.mustChangeToken);
      if (!userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Recovery link expired. Please sign in again.",
        });
      }
      const db = getDb();
      const userRow = await db
        .select({
          id: schema.users.id,
          createdAt: schema.users.createdAt,
          accountType: schema.users.accountType,
          requirePasswordChange: schema.users.requirePasswordChange,
        })
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1);
      const user = userRow[0];
      if (!user || !user.requirePasswordChange) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This recovery step is no longer needed.",
        });
      }
      const newHash = await bcrypt.hash(input.newPassword, 12);
      await db
        .update(schema.users)
        .set({ passwordHash: newHash, requirePasswordChange: false })
        .where(eq(schema.users.id, userId));

      const issued = await issueSessionWithContext(
        ctx,
        user.id,
        user.accountType,
        user.createdAt,
      );
      // Touch the consumed flag implicitly: the token is signed +
      // single-account-state-bound, so once requirePasswordChange is
      // cleared the same token can't be reused.
      void hashNonce;
      return { ...issued.auth, lastLogin: issued.lastLogin };
    }),

  /* ─────────── Premium login flow (V2 — kept for compat) ─────────── */

  /**
   * Step 1 of the new login flow. Verifies the username + password,
   * silently classifies the request risk, and either:
   *   - returns a full session immediately (low risk), or
   *   - returns a short-lived challenge nonce (medium/high risk),
   *     which the client must then return alongside a bot-puzzle
   *     token via `auth.completeLoginV2`.
   *
   * Lockout: 3 failed attempts from the same (username, IP) within
   * 10 minutes blocks further attempts for 10 minutes.
   */
  beginLoginV2: configuredProcedure
    .input(BeginLoginV2Input)
    .output(BeginLoginV2Result)
    .mutation(async ({ input, ctx }) => {
      const db = getDb();

      // Hard lockout (3-strikes) — checked BEFORE rate limiting so
      // blocked users get a clear message and a retry-after.
      const lockout = checkLockout(input.username, ctx.ip);
      if (lockout.blocked) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Too many attempts. Please try again in ${Math.ceil(
            lockout.retryInSeconds / 60,
          )} minute${lockout.retryInSeconds >= 120 ? "s" : ""}.`,
        });
      }

      // Volume rate limit (per IP and per username).
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
      // Constant-time-ish dummy compare so we don't leak account
      // existence via response timing.
      const hash =
        row?.passwordHash ??
        "$2a$12$abcdefghijklmnopqrstuuabcdefghijklmnopqrstuvwxyz012345";
      const ok = await bcrypt.compare(input.password, hash);

      if (!row || !ok) {
        const after = recordFailure(input.username, ctx.ip);
        if (after.blocked) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `Too many attempts. Please try again in ${Math.ceil(
              after.retryInSeconds / 60,
            )} minutes.`,
          });
        }
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Wrong username or password.",
        });
      }

      // Risk classification against the user's known sessions.
      const knownSessions = await db
        .select({
          ipPrefix: schema.sessions.ipPrefix,
          deviceLabel: schema.sessions.deviceLabel,
        })
        .from(schema.sessions)
        .where(eq(schema.sessions.userId, row.id))
        .orderBy(desc(schema.sessions.createdAt))
        .limit(20);

      const ua =
        (ctx.req.headers["user-agent"] as string | undefined) ?? null;
      const risk = classifyRisk({
        knownDevices: knownSessions,
        ip: ctx.ip,
        userAgent: ua,
        failuresInWindow: checkLockout(input.username, ctx.ip).failuresInWindow,
      });

      if (risk.level === "low") {
        clearFailures(input.username, ctx.ip);
        const issued = await issueSessionWithContext(
          ctx,
          row.id,
          "random",
          row.createdAt,
        );
        return {
          status: "ok" as const,
          lastLogin: issued.lastLogin,
          ...issued.auth,
        };
      }

      // Medium / high → require puzzle + press-and-hold on the client.
      const challenge = issueLoginChallenge(row.id, ctx.ip, ua);
      return {
        status: "challenge" as const,
        risk: risk.level,
        reasons: risk.reasons,
        challengeNonce: challenge.nonce,
        challengeExpiresInSeconds: challenge.expiresInSeconds,
      };
    }),

  /**
   * Step 2 of the new login flow. Burns the bot-challenge token from
   * the slide puzzle, validates the pending challenge nonce minted by
   * `beginLoginV2`, and only then issues a real session.
   */
  completeLoginV2: configuredProcedure
    .input(CompleteLoginV2Input)
    .output(CompleteLoginV2Result)
    .mutation(async ({ input, ctx }) => {
      if (!consumeBotToken(input.botToken)) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Verification expired. Please try again.",
        });
      }
      const userId = consumeLoginChallenge(input.challengeNonce);
      if (!userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Sign-in attempt expired. Please start over.",
        });
      }

      const db = getDb();
      const found = await db
        .select({
          id: schema.users.id,
          createdAt: schema.users.createdAt,
          accountType: schema.users.accountType,
        })
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1);
      const row = found[0];
      if (!row) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Account no longer exists.",
        });
      }

      // The risky branch implies the user did pass the password check
      // a moment ago — clear any failure counters so subsequent logins
      // start clean.
      const issued = await issueSessionWithContext(
        ctx,
        row.id,
        row.accountType,
        row.createdAt,
      );
      // Best-effort: we don't know the username anymore, so just clear
      // the per-IP side too.
      clearFailures("", ctx.ip);
      // Reference the imported helper so the type checker doesn't drop it.
      void deviceFingerprint;
      return {
        ...issued.auth,
        lastLogin: issued.lastLogin,
      };
    }),

  /**
   * Returns the user's most-recent N sessions for display in
   * Settings → Security → Sign-in activity. Each entry is a sanitized
   * view of a `sessions` row: device label, coarse city/country,
   * timestamps, and a flag marking the row that belongs to the
   * caller's current refresh token.
   *
   * We never return the refresh-token hash or the raw IP — only what
   * is safe to render in the UI.
   */
  listSessions: protectedProcedure
    .output(ListSessionsResult)
    .query(async ({ ctx }) => {
      const db = getDb();
      const rows = await db
        .select({
          id: schema.sessions.id,
          deviceLabel: schema.sessions.deviceLabel,
          city: schema.sessions.lastCity,
          country: schema.sessions.lastCountry,
          createdAt: schema.sessions.createdAt,
          lastUsedAt: schema.sessions.lastUsedAt,
          expiresAt: schema.sessions.expiresAt,
          refreshTokenHash: schema.sessions.refreshTokenHash,
        })
        .from(schema.sessions)
        .where(eq(schema.sessions.userId, ctx.userId))
        .orderBy(desc(schema.sessions.lastUsedAt))
        .limit(10);

      // Identify the caller's "current" session by hashing their
      // refresh-token cookie (best-effort — falls back to "none current"
      // when the cookie is missing, e.g. on access-token-only flows).
      const token = readRefreshToken(
        ctx.req as unknown as {
          headers: Record<string, string | string[] | undefined>;
          cookies?: Record<string, string>;
        },
      );
      const currentHash = token ? sha256Hex(token) : null;

      return rows.map((r) => ({
        id: r.id,
        device: describeDevice(r.deviceLabel),
        city: r.city ?? null,
        country: r.country ?? null,
        createdAt: r.createdAt.toISOString(),
        lastUsedAt: r.lastUsedAt.toISOString(),
        expiresAt: r.expiresAt.toISOString(),
        isCurrent: currentHash !== null && r.refreshTokenHash === currentHash,
      }));
    }),

  /**
   * Sign out a specific device by deleting its session row. Refuses
   * to delete the caller's own current session (use `auth.logout` for
   * that — it also clears the cookie). Idempotent: returns `removed:
   * 0` when the row doesn't exist or belongs to someone else.
   */
  revokeSession: protectedProcedure
    .input(RevokeSessionInput)
    .output(RevokeSessionResult)
    .mutation(async ({ input, ctx }) => {
      const db = getDb();

      // Refuse to delete the current session via this endpoint — that
      // would leave a stale refresh cookie on the caller's browser.
      const token = readRefreshToken(
        ctx.req as unknown as {
          headers: Record<string, string | string[] | undefined>;
          cookies?: Record<string, string>;
        },
      );
      if (token) {
        const found = await db
          .select({ id: schema.sessions.id })
          .from(schema.sessions)
          .where(eq(schema.sessions.refreshTokenHash, sha256Hex(token)))
          .limit(1);
        if (found[0]?.id === input.sessionId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Use the regular sign-out for this device — it also clears local credentials.",
          });
        }
      }

      const deleted = await db
        .delete(schema.sessions)
        .where(
          and(
            eq(schema.sessions.id, input.sessionId),
            eq(schema.sessions.userId, ctx.userId),
          ),
        )
        .returning({ id: schema.sessions.id });

      return { ok: true as const, removed: deleted.length };
    }),

  /**
   * Returns the user's previous sign-in context (city + device), or
   * null when there is no prior session. Used by the welcome step on
   * the client.
   */
  getLastLoginInfo: protectedProcedure
    .output(LastLoginInfoResult)
    .query(async ({ ctx }) => {
      const db = getDb();
      // The newest session belongs to the *current* sign-in; we want
      // the one before it.
      const rows = await db
        .select({
          city: schema.sessions.lastCity,
          country: schema.sessions.lastCountry,
          deviceLabel: schema.sessions.deviceLabel,
          createdAt: schema.sessions.createdAt,
        })
        .from(schema.sessions)
        .where(eq(schema.sessions.userId, ctx.userId))
        .orderBy(desc(schema.sessions.createdAt))
        .limit(2);
      const prev = rows[1] ?? null;
      if (!prev) return null;
      return {
        city: prev.city ?? null,
        country: prev.country ?? null,
        device: describeDevice(prev.deviceLabel),
        at: prev.createdAt.toISOString(),
      };
    }),
});
