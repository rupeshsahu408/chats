/**
 * Daily verification gate (24-hour security password).
 *
 * After signup, the user picks a separate "verification password" that
 * the app requires every 24 hours before letting them back into the
 * main chat surface. The timestamp of the last successful check is
 * stored per-user in localStorage; the password itself never touches
 * the device.
 */

const PREFIX = "veil:dailyVerifiedAt:";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function key(userId: string): string {
  return `${PREFIX}${userId}`;
}

export function getLastVerifiedAt(userId: string): number | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function markDailyVerified(userId: string, at: number = Date.now()): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key(userId), String(at));
  } catch {
    /* storage may be disabled (private mode) — ignore */
  }
}

export function clearDailyVerified(userId: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(key(userId));
  } catch {
    /* ignore */
  }
}

export function isDailyVerificationDue(userId: string): boolean {
  const at = getLastVerifiedAt(userId);
  if (at === null) return true;
  return Date.now() - at >= ONE_DAY_MS;
}

export const DAILY_VERIFICATION_INTERVAL_MS = ONE_DAY_MS;
