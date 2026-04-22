import "dotenv/config";

function num(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function str(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const t = value.trim();
  return t.length === 0 ? undefined : t;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  HOST: process.env.HOST ?? "0.0.0.0",
  PORT: num(process.env.PORT, 3001),
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? "",

  DATABASE_URL: str(process.env.DATABASE_URL),

  JWT_SECRET: str(process.env.JWT_SECRET),
  REFRESH_TOKEN_SECRET: str(process.env.REFRESH_TOKEN_SECRET),
  IDENTIFIER_HMAC_PEPPER: str(process.env.IDENTIFIER_HMAC_PEPPER),

  RESEND_API_KEY: str(process.env.RESEND_API_KEY),
  RESEND_FROM: str(process.env.RESEND_FROM) ?? "Veil <onboarding@resend.dev>",

  FIREBASE_PROJECT_ID: str(process.env.FIREBASE_PROJECT_ID),
  FIREBASE_CLIENT_EMAIL: str(process.env.FIREBASE_CLIENT_EMAIL),
  FIREBASE_PRIVATE_KEY: str(process.env.FIREBASE_PRIVATE_KEY),

  COOKIE_SECURE: process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === "true"
    : process.env.NODE_ENV === "production",

  /* Web Push (VAPID). Auto-generated for dev if missing. */
  VAPID_PUBLIC_KEY: str(process.env.VAPID_PUBLIC_KEY),
  VAPID_PRIVATE_KEY: str(process.env.VAPID_PRIVATE_KEY),
  VAPID_SUBJECT: str(process.env.VAPID_SUBJECT) ?? "mailto:noreply@veil.local",

  /* Encrypted media (server-side blob store). */
  MEDIA_MAX_BYTES: num(process.env.MEDIA_MAX_BYTES, 8 * 1024 * 1024),
  MEDIA_TTL_HOURS: num(process.env.MEDIA_TTL_HOURS, 24),
} as const;

export const isDev = env.NODE_ENV !== "production";

/**
 * Returns a list of human-readable warnings about missing config.
 * Auth endpoints will refuse to operate while this list is non-empty.
 */
export function missingAuthConfig(): string[] {
  const missing: string[] = [];
  if (!env.DATABASE_URL) missing.push("DATABASE_URL");
  if (!env.JWT_SECRET) missing.push("JWT_SECRET");
  if (!env.REFRESH_TOKEN_SECRET) missing.push("REFRESH_TOKEN_SECRET");
  if (!env.IDENTIFIER_HMAC_PEPPER) missing.push("IDENTIFIER_HMAC_PEPPER");
  return missing;
}
