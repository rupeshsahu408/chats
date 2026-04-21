import "dotenv/config";

function num(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  HOST: process.env.HOST ?? "0.0.0.0",
  PORT: num(process.env.PORT, 3001),
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? "",
} as const;

export const isDev = env.NODE_ENV !== "production";
