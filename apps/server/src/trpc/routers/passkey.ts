import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";

/**
 * Subset of @simplewebauthn/types we depend on. The full types live in
 * a transitive dependency (@simplewebauthn/types) which we don't want
 * to declare as a direct dependency just for two type aliases.
 */
type AuthenticatorTransportFuture =
  | "ble"
  | "cable"
  | "hybrid"
  | "internal"
  | "nfc"
  | "smart-card"
  | "usb";

interface WebAuthnCredential {
  id: string;
  publicKey: Uint8Array;
  counter: number;
  transports?: AuthenticatorTransportFuture[];
}

import { configuredProcedure, protectedProcedure, router } from "../init.js";
import { getDb, schema } from "../../db/index.js";
import {
  rememberRegistrationChallenge,
  consumeRegistrationChallenge,
  rememberAuthenticationChallenge,
  consumeAuthenticationChallenge,
} from "../../lib/passkeyChallenge.js";
import {
  signAccessToken,
  generateRefreshToken,
  TOKEN_TTL,
} from "../../lib/jwt.js";
import { sha256Hex } from "../../lib/hash.js";
import { env } from "../../env.js";

/**
 * Passkey (WebAuthn) registration + authentication endpoints.
 *
 * The relying-party identity (rpID + origin) is derived per request
 * from the `Origin` header so the same backend works in dev (localhost
 * or replit.dev) and in production without env wiring. We treat the
 * full origin as the source of truth and pin rpID to its hostname.
 */

const RP_NAME = "Veil";
const APP_NAME = "Veil";

interface RpInfo {
  rpID: string;
  origin: string;
}

function getRpInfo(req: {
  headers: Record<string, string | string[] | undefined>;
}): RpInfo {
  const originRaw = req.headers["origin"];
  const origin = Array.isArray(originRaw) ? originRaw[0] : originRaw;
  if (!origin) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Origin header is required for passkey operations.",
    });
  }
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid Origin header.",
    });
  }
  return { rpID: url.hostname, origin: url.origin };
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

/* ─────────── Schemas ─────────── */

const RegistrationOptionsResult = z.object({
  options: z.unknown(),
});

const VerifyRegistrationInput = z.object({
  response: z.unknown(),
  deviceName: z.string().min(1).max(60),
});

const VerifyRegistrationResult = z.object({
  ok: z.boolean(),
  passkeyId: z.string(),
});

const AuthenticationOptionsResult = z.object({
  sessionId: z.string(),
  options: z.unknown(),
});

const VerifyAuthenticationInput = z.object({
  sessionId: z.string().min(1).max(200),
  response: z.unknown(),
});

const PasskeyListResult = z.array(
  z.object({
    id: z.string(),
    deviceName: z.string(),
    createdAt: z.string(),
    lastUsedAt: z.string().nullable(),
  }),
);

const RenameInput = z.object({
  id: z.string().uuid(),
  deviceName: z.string().min(1).max(60),
});

const DeleteInput = z.object({ id: z.string().uuid() });

/* ─────────── Helpers ─────────── */

function userIdToBytes(userId: string): Uint8Array {
  // SimpleWebAuthn requires the userID as raw bytes. We hash the
  // server-side UUID to get a stable 32-byte handle that doesn't
  // leak the literal database key.
  return new Uint8Array(Buffer.from(sha256Hex(userId), "hex"));
}

function bufferToBase64Url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlToBuffer(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function parseTransports(
  raw: string | null,
): AuthenticatorTransportFuture[] | undefined {
  if (!raw) return undefined;
  const list = raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return list.length > 0
    ? (list as AuthenticatorTransportFuture[])
    : undefined;
}

/* ─────────── Router ─────────── */

export const passkeyRouter = router({
  /** Issue WebAuthn registration options for the logged-in user. */
  getRegistrationOptions: protectedProcedure.mutation(async ({ ctx }) => {
    const db = getDb();
    const { rpID } = getRpInfo(ctx.req);

    const userRow = await db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        displayName: schema.users.displayName,
      })
      .from(schema.users)
      .where(eq(schema.users.id, ctx.userId))
      .limit(1);

    const user = userRow[0];
    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
    }

    const existing = await db
      .select({
        credentialId: schema.passkeys.credentialId,
        transports: schema.passkeys.transports,
      })
      .from(schema.passkeys)
      .where(eq(schema.passkeys.userId, ctx.userId));

    const userName = user.username ?? `veil-${user.id.slice(0, 8)}`;
    const userDisplay = user.displayName ?? userName;

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID,
      userID: userIdToBytes(user.id),
      userName,
      userDisplayName: userDisplay,
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
      excludeCredentials: existing.map((c) => ({
        id: c.credentialId,
        transports: parseTransports(c.transports),
      })),
    });

    rememberRegistrationChallenge(ctx.userId, options.challenge);
    return RegistrationOptionsResult.parse({ options });
  }),

  /** Verify a WebAuthn registration response and persist the credential. */
  verifyRegistration: protectedProcedure
    .input(VerifyRegistrationInput)
    .output(VerifyRegistrationResult)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const { rpID, origin } = getRpInfo(ctx.req);

      const expectedChallenge = consumeRegistrationChallenge(ctx.userId);
      if (!expectedChallenge) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Your passkey setup expired. Please try adding the passkey again.",
        });
      }

      let verification;
      try {
        verification = await verifyRegistrationResponse({
          response: input.response as never,
          expectedChallenge,
          expectedOrigin: origin,
          expectedRPID: rpID,
          requireUserVerification: false,
        });
      } catch (e) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Passkey could not be verified: ${
            e instanceof Error ? e.message : "unknown error"
          }`,
        });
      }

      if (!verification.verified || !verification.registrationInfo) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Passkey verification failed.",
        });
      }

      const { credential, credentialBackedUp } = verification.registrationInfo;
      const credentialId = credential.id;
      const credentialPublicKey = credential.publicKey;
      const counter = credential.counter;
      const transports = credential.transports?.join(",") ?? null;

      // Reject if this credential is already attached to any user.
      const existing = await db
        .select({ id: schema.passkeys.id })
        .from(schema.passkeys)
        .where(eq(schema.passkeys.credentialId, credentialId))
        .limit(1);
      if (existing[0]) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This passkey is already registered.",
        });
      }

      const inserted = await db
        .insert(schema.passkeys)
        .values({
          userId: ctx.userId,
          credentialId,
          publicKey: Buffer.from(credentialPublicKey),
          counter,
          transports,
          deviceName: input.deviceName.slice(0, 60),
          isBackedUp: credentialBackedUp,
        })
        .returning({ id: schema.passkeys.id });

      const row = inserted[0];
      if (!row) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not save the passkey.",
        });
      }
      return { ok: true, passkeyId: row.id };
    }),

  /** List the current user's registered passkeys. */
  list: protectedProcedure
    .output(PasskeyListResult)
    .query(async ({ ctx }) => {
      const db = getDb();
      const rows = await db
        .select({
          id: schema.passkeys.id,
          deviceName: schema.passkeys.deviceName,
          createdAt: schema.passkeys.createdAt,
          lastUsedAt: schema.passkeys.lastUsedAt,
        })
        .from(schema.passkeys)
        .where(eq(schema.passkeys.userId, ctx.userId));
      return rows.map((r) => ({
        id: r.id,
        deviceName: r.deviceName,
        createdAt: r.createdAt.toISOString(),
        lastUsedAt: r.lastUsedAt ? r.lastUsedAt.toISOString() : null,
      }));
    }),

  /** Rename a passkey (friendly device label only). */
  rename: protectedProcedure
    .input(RenameInput)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const result = await db
        .update(schema.passkeys)
        .set({ deviceName: input.deviceName.slice(0, 60) })
        .where(
          and(
            eq(schema.passkeys.id, input.id),
            eq(schema.passkeys.userId, ctx.userId),
          ),
        )
        .returning({ id: schema.passkeys.id });
      if (!result[0]) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return { ok: true };
    }),

  /** Delete one of the current user's passkeys. */
  delete: protectedProcedure
    .input(DeleteInput)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const result = await db
        .delete(schema.passkeys)
        .where(
          and(
            eq(schema.passkeys.id, input.id),
            eq(schema.passkeys.userId, ctx.userId),
          ),
        )
        .returning({ id: schema.passkeys.id });
      if (!result[0]) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return { ok: true };
    }),

  /**
   * Issue WebAuthn authentication options. Public — anyone with a
   * registered passkey can sign in with it. We use discoverable
   * credentials so the user doesn't have to type their username
   * first; the browser shows them their available passkeys.
   */
  getAuthenticationOptions: configuredProcedure
    .output(AuthenticationOptionsResult)
    .mutation(async ({ ctx }) => {
      const { rpID } = getRpInfo(ctx.req);
      const options = await generateAuthenticationOptions({
        rpID,
        userVerification: "preferred",
      });
      const sessionId = randomBytes(16).toString("base64url");
      rememberAuthenticationChallenge(sessionId, options.challenge);
      return { sessionId, options };
    }),

  /**
   * Verify a WebAuthn authentication response and issue a session.
   * Looks the user up via the credential ID returned by the browser.
   */
  verifyAuthentication: configuredProcedure
    .input(VerifyAuthenticationInput)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const { rpID, origin } = getRpInfo(ctx.req);

      const expectedChallenge = consumeAuthenticationChallenge(input.sessionId);
      if (!expectedChallenge) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Your sign-in attempt expired. Please try again.",
        });
      }

      const response = input.response as {
        id?: string;
        rawId?: string;
      };
      const credentialId = response?.id ?? response?.rawId;
      if (!credentialId || typeof credentialId !== "string") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Malformed passkey response.",
        });
      }

      const rows = await db
        .select({
          id: schema.passkeys.id,
          userId: schema.passkeys.userId,
          credentialId: schema.passkeys.credentialId,
          publicKey: schema.passkeys.publicKey,
          counter: schema.passkeys.counter,
          transports: schema.passkeys.transports,
        })
        .from(schema.passkeys)
        .where(eq(schema.passkeys.credentialId, credentialId))
        .limit(1);
      const row = rows[0];
      if (!row) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Unknown passkey. It may have been removed.",
        });
      }

      const credential: WebAuthnCredential = {
        id: row.credentialId,
        publicKey: new Uint8Array(row.publicKey),
        counter: row.counter,
        transports: parseTransports(row.transports),
      };

      let verification;
      try {
        verification = await verifyAuthenticationResponse({
          response: input.response as never,
          expectedChallenge,
          expectedOrigin: origin,
          expectedRPID: rpID,
          credential,
          requireUserVerification: false,
        });
      } catch (e) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: `Passkey verification failed: ${
            e instanceof Error ? e.message : "unknown"
          }`,
        });
      }

      if (!verification.verified) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Passkey verification failed.",
        });
      }

      // Update counter + lastUsedAt
      await db
        .update(schema.passkeys)
        .set({
          counter: verification.authenticationInfo.newCounter,
          lastUsedAt: new Date(),
        })
        .where(eq(schema.passkeys.id, row.id));

      // Look up the user and mint a session.
      const userRow = await db
        .select({
          id: schema.users.id,
          accountType: schema.users.accountType,
          createdAt: schema.users.createdAt,
          username: schema.users.username,
          displayName: schema.users.displayName,
          bio: schema.users.bio,
          avatarDataUrl: schema.users.avatarDataUrl,
        })
        .from(schema.users)
        .where(eq(schema.users.id, row.userId))
        .limit(1);
      const user = userRow[0];
      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Account no longer exists.",
        });
      }

      const accessToken = await signAccessToken({ sub: user.id });
      const refreshToken = generateRefreshToken();
      const refreshExpires = new Date(
        Date.now() + TOKEN_TTL.refreshSeconds * 1000,
      );
      await db.insert(schema.sessions).values({
        userId: user.id,
        refreshTokenHash: sha256Hex(refreshToken),
        deviceLabel:
          (ctx.req.headers["user-agent"] as string | undefined)?.slice(
            0,
            200,
          ) ?? null,
        expiresAt: refreshExpires,
      });
      await db
        .update(schema.users)
        .set({ lastSeenAt: new Date() })
        .where(eq(schema.users.id, user.id));

      setRefreshCookie(ctx.res as never, refreshToken);

      // Mark unused vars as referenced for type checker.
      void APP_NAME;
      void bufferToBase64Url;
      void base64UrlToBuffer;

      return {
        user: {
          id: user.id,
          accountType: user.accountType,
          createdAt: user.createdAt.toISOString(),
          username: user.username,
          displayName: user.displayName,
          bio: user.bio,
          avatarDataUrl: user.avatarDataUrl,
        },
        accessToken,
        refreshToken,
        refreshExpiresIn: TOKEN_TTL.refreshSeconds,
        expiresIn: TOKEN_TTL.accessSeconds,
      };
    }),
});
