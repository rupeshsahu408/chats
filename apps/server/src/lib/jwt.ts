import { SignJWT, jwtVerify } from "jose";
import { randomBytes } from "node:crypto";
import { env } from "../env.js";

const ACCESS_TTL_SECONDS = 15 * 60; // 15 min
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

function key(secret: string | undefined): Uint8Array {
  if (!secret) throw new Error("JWT secret missing");
  return new TextEncoder().encode(secret);
}

export interface AccessTokenClaims {
  sub: string; // user id
}

export async function signAccessToken(claims: AccessTokenClaims): Promise<string> {
  return await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setIssuer("veil")
    .setAudience("veil-client")
    .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
    .sign(key(env.JWT_SECRET));
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
  const { payload } = await jwtVerify(token, key(env.JWT_SECRET), {
    issuer: "veil",
    audience: "veil-client",
  });
  if (typeof payload.sub !== "string") throw new Error("Invalid token: no sub");
  return { sub: payload.sub };
}

/** Generates an opaque random refresh token (not a JWT) — server tracks it. */
export function generateRefreshToken(): string {
  return randomBytes(48).toString("base64url");
}

export const TOKEN_TTL = {
  accessSeconds: ACCESS_TTL_SECONDS,
  refreshSeconds: REFRESH_TTL_SECONDS,
};
