import dotenv from "dotenv";
// `override: true` makes apps/server/.env win over any DATABASE_URL
// (or other vars) injected by the host/workspace. This way the server
// always uses the Neon connection string the operator put in .env,
// not whatever the dev container happens to provide.
dotenv.config({ override: true });

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

  /* Encrypted media (Cloudflare R2 — clients upload/download directly). */
  MEDIA_MAX_BYTES: num(process.env.MEDIA_MAX_BYTES, 16 * 1024 * 1024),
  MEDIA_TTL_HOURS: num(process.env.MEDIA_TTL_HOURS, 24),
  R2_ACCOUNT_ID: str(process.env.R2_ACCOUNT_ID),
  R2_ACCESS_KEY_ID: str(process.env.R2_ACCESS_KEY_ID),
  R2_SECRET_ACCESS_KEY: str(process.env.R2_SECRET_ACCESS_KEY),
  R2_BUCKET: str(process.env.R2_BUCKET),

  /* SMTP — used to mirror abuse reports to the operator's inbox. */
  SMTP_HOST: str(process.env.SMTP_HOST),
  SMTP_PORT: num(process.env.SMTP_PORT, 587),
  SMTP_USER: str(process.env.SMTP_USER),
  SMTP_PASS: str(process.env.SMTP_PASS),
  SMTP_FROM: str(process.env.SMTP_FROM),
  REPORT_EMAIL_TO: str(process.env.REPORT_EMAIL_TO),
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
