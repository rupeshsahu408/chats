import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";

export const OTP_TTL_SECONDS = 5 * 60;
export const OTP_MAX_ATTEMPTS = 5;

/** Cryptographically random 6-digit code as a zero-padded string. */
export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export async function hashOtp(code: string): Promise<string> {
  return await bcrypt.hash(code, 10);
}

export async function verifyOtp(code: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(code, hash);
}
