import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../env.js";

/**
 * Login risk classification + lockout + pending-challenge tracking.
 *
 * The login flow is:
 *   1. user submits username + password
 *   2. server verifies credentials silently
 *   3. server classifies the request (this module) using:
 *        - device fingerprint (normalized user-agent)
 *        - network (IPv4 /24 prefix)
 *        - recent failure count
 *      against the user's existing `sessions` table
 *   4. low risk → issue session immediately
 *      medium/high risk → return a short-lived challenge nonce
 *   5. client solves the bot puzzle and re-posts (nonce, botToken)
 *      to `auth.completeLoginV2`
 *
 * In addition we track failed attempts per (user, ip) and impose a
 * temporary block after 3 failures within 10 minutes — independent of
 * the broader rate limiter, which is purely volume throttling.
 *
 * All state is in-memory; suitable for a single-instance server. When
 * we move to multiple replicas this module becomes the natural seam to
 * back with Redis.
 */

const CHALLENGE_TTL_MS = 2 * 60_000;
const PENDING_MAX = 5_000;

const FAILURE_LIMIT = 3;
const FAILURE_WINDOW_MS = 10 * 60_000;
const BLOCK_DURATION_MS = 10 * 60_000;
const FAILURE_MAX = 20_000;

const GEO_CACHE_TTL_MS = 24 * 60 * 60_000;
const GEO_CACHE_MAX = 5_000;
const GEO_LOOKUP_TIMEOUT_MS = 1500;

interface PendingChallenge {
  userId: string;
  ip: string;
  userAgent: string;
  expiresAt: number;
}

interface FailureRecord {
  count: number;
  windowResetAt: number;
  blockedUntil: number;
}

interface GeoCacheEntry {
  city: string | null;
  country: string | null;
  expiresAt: number;
}

const pending = new Map<string, PendingChallenge>();
const failures = new Map<string, FailureRecord>();
const geoCache = new Map<string, GeoCacheEntry>();

/* ─────────── helpers ─────────── */

function gcPending() {
  const now = Date.now();
  if (pending.size > PENDING_MAX) {
    for (const [k, v] of pending) if (v.expiresAt <= now) pending.delete(k);
  }
}
function gcFailures() {
  const now = Date.now();
  if (failures.size > FAILURE_MAX) {
    for (const [k, v] of failures) {
      if (v.blockedUntil <= now && v.windowResetAt <= now) failures.delete(k);
    }
  }
}
function gcGeo() {
  const now = Date.now();
  if (geoCache.size > GEO_CACHE_MAX) {
    for (const [k, v] of geoCache) if (v.expiresAt <= now) geoCache.delete(k);
  }
}

/**
 * Compute a coarse "network" identifier so we can spot logins from a
 * brand-new network without storing the full IP. For IPv4 we keep the
 * first three octets; for IPv6 we keep the first four hex groups
 * (effectively the /64 routing prefix). Returns null when we can't
 * parse the input.
 */
export function ipPrefix(ip: string | null | undefined): string | null {
  if (!ip || ip === "unknown") return null;
  // Strip IPv6 zone id and IPv4-mapped prefix.
  let cleaned = ip.split("%")[0]!.trim();
  if (cleaned.startsWith("::ffff:")) cleaned = cleaned.slice(7);
  if (cleaned.includes(":")) {
    const parts = cleaned.split(":").filter(Boolean);
    if (parts.length === 0) return null;
    return parts.slice(0, 4).join(":");
  }
  const parts = cleaned.split(".");
  if (parts.length !== 4) return null;
  return parts.slice(0, 3).join(".");
}

/**
 * Normalize a user-agent string into a stable, low-cardinality device
 * fingerprint. We keep only OS family + browser family so that minor
 * version bumps don't look like a brand-new device. Best-effort; bad
 * input → "unknown".
 */
export function deviceFingerprint(ua: string | null | undefined): string {
  if (!ua) return "unknown";
  const lower = ua.toLowerCase();
  let os = "other";
  if (/windows/.test(lower)) os = "windows";
  else if (/iphone|ipad|ios/.test(lower)) os = "ios";
  else if (/android/.test(lower)) os = "android";
  else if (/mac os|macintosh/.test(lower)) os = "macos";
  else if (/linux/.test(lower)) os = "linux";

  let browser = "other";
  if (/edg\//.test(lower)) browser = "edge";
  else if (/firefox/.test(lower)) browser = "firefox";
  else if (/opera|opr\//.test(lower)) browser = "opera";
  else if (/chrome/.test(lower)) browser = "chrome";
  else if (/safari/.test(lower)) browser = "safari";

  return `${os}:${browser}`;
}

/** Friendly form of the same fingerprint for showing to the user. */
export function deviceLabel(ua: string | null | undefined): string {
  const fp = deviceFingerprint(ua);
  const [os, browser] = fp.split(":");
  const osName =
    os === "ios"
      ? "iOS"
      : os === "macos"
        ? "macOS"
        : os === "windows"
          ? "Windows"
          : os === "android"
            ? "Android"
            : os === "linux"
              ? "Linux"
              : "Unknown device";
  const browserName =
    browser === "chrome"
      ? "Chrome"
      : browser === "safari"
        ? "Safari"
        : browser === "firefox"
          ? "Firefox"
          : browser === "edge"
            ? "Edge"
            : browser === "opera"
              ? "Opera"
              : "Browser";
  return `${browserName} on ${osName}`;
}

/* ─────────── failure tracking ─────────── */

function failureKey(username: string, ip: string): string {
  return `${username.toLowerCase()}|${ip}`;
}

export interface LockoutCheck {
  blocked: boolean;
  /** Seconds until the user can try again. 0 when not blocked. */
  retryInSeconds: number;
  /** Failures observed in the current window (post-recording). */
  failuresInWindow: number;
}

/**
 * Returns whether the (username, ip) pair is currently locked out, and
 * how many seconds remain. Does not record anything.
 */
export function checkLockout(username: string, ip: string): LockoutCheck {
  gcFailures();
  const now = Date.now();
  const rec = failures.get(failureKey(username, ip));
  if (!rec) return { blocked: false, retryInSeconds: 0, failuresInWindow: 0 };
  if (rec.blockedUntil > now) {
    return {
      blocked: true,
      retryInSeconds: Math.ceil((rec.blockedUntil - now) / 1000),
      failuresInWindow: rec.count,
    };
  }
  if (rec.windowResetAt <= now) {
    failures.delete(failureKey(username, ip));
    return { blocked: false, retryInSeconds: 0, failuresInWindow: 0 };
  }
  return { blocked: false, retryInSeconds: 0, failuresInWindow: rec.count };
}

/**
 * Record a failed login. After FAILURE_LIMIT failures inside the
 * sliding window, the (username, ip) pair is blocked for
 * BLOCK_DURATION_MS. Returns the same shape as `checkLockout`.
 */
export function recordFailure(username: string, ip: string): LockoutCheck {
  gcFailures();
  const now = Date.now();
  const key = failureKey(username, ip);
  const rec = failures.get(key);
  if (!rec || rec.windowResetAt <= now) {
    failures.set(key, {
      count: 1,
      windowResetAt: now + FAILURE_WINDOW_MS,
      blockedUntil: 0,
    });
    return { blocked: false, retryInSeconds: 0, failuresInWindow: 1 };
  }
  rec.count += 1;
  if (rec.count >= FAILURE_LIMIT) {
    rec.blockedUntil = now + BLOCK_DURATION_MS;
    return {
      blocked: true,
      retryInSeconds: Math.ceil(BLOCK_DURATION_MS / 1000),
      failuresInWindow: rec.count,
    };
  }
  return { blocked: false, retryInSeconds: 0, failuresInWindow: rec.count };
}

/** Clear the failure counter for a (username, ip) pair after success. */
export function clearFailures(username: string, ip: string) {
  failures.delete(failureKey(username, ip));
}

/* ─────────── risk classification ─────────── */

export interface RiskInputs {
  /** All previous sessions for this user (most recent first). */
  knownDevices: { ipPrefix: string | null; deviceLabel: string | null }[];
  ip: string;
  userAgent: string | null;
  failuresInWindow: number;
}

export interface RiskResult {
  level: "low" | "medium" | "high";
  reasons: string[];
  newDevice: boolean;
  newNetwork: boolean;
}

export function classifyRisk(inputs: RiskInputs): RiskResult {
  const fp = deviceFingerprint(inputs.userAgent);
  const prefix = ipPrefix(inputs.ip);

  // First-ever sign-in is implicitly low risk; the user clearly has no
  // baseline to compare against and forcing a puzzle would feel odd.
  if (inputs.knownDevices.length === 0) {
    return {
      level: "low",
      reasons: [],
      newDevice: false,
      newNetwork: false,
    };
  }

  const knownFingerprints = new Set(
    inputs.knownDevices
      .map((d) => deviceFingerprint(d.deviceLabel))
      .filter((f) => f !== "unknown"),
  );
  const knownPrefixes = new Set(
    inputs.knownDevices
      .map((d) => d.ipPrefix)
      .filter((p): p is string => Boolean(p)),
  );

  // If we have no useful baseline (e.g. all legacy rows), don't penalise.
  const hasFingerprintBaseline = knownFingerprints.size > 0;
  const hasPrefixBaseline = knownPrefixes.size > 0;

  const newDevice =
    fp !== "unknown" && hasFingerprintBaseline && !knownFingerprints.has(fp);
  const newNetwork =
    prefix !== null && hasPrefixBaseline && !knownPrefixes.has(prefix);

  const reasons: string[] = [];
  if (newDevice) reasons.push("new device or browser");
  if (newNetwork) reasons.push("new network");
  if (inputs.failuresInWindow >= 1) reasons.push("recent failed attempts");

  let level: "low" | "medium" | "high" = "low";
  let score = 0;
  if (newDevice) score += 1;
  if (newNetwork) score += 1;
  if (inputs.failuresInWindow >= 2) score += 2;
  else if (inputs.failuresInWindow >= 1) score += 1;

  if (score >= 3) level = "high";
  else if (score >= 1) level = "medium";

  return { level, reasons, newDevice, newNetwork };
}

/* ─────────── pending challenge tokens ─────────── */

function challengeKey(): Buffer {
  if (!env.JWT_SECRET) throw new Error("JWT_SECRET missing");
  return Buffer.from(`login-challenge:${env.JWT_SECRET}`);
}

/**
 * Mint a one-shot challenge nonce for a (userId, ip, ua) trio. The
 * nonce embeds an HMAC binding so a leaked nonce alone (without
 * regenerating an identical fingerprint) cannot complete the login.
 */
export function issueLoginChallenge(
  userId: string,
  ip: string,
  userAgent: string | null,
): { nonce: string; expiresInSeconds: number } {
  gcPending();
  const id = randomBytes(16).toString("base64url");
  const expiresAt = Date.now() + CHALLENGE_TTL_MS;
  pending.set(id, {
    userId,
    ip,
    userAgent: userAgent ?? "",
    expiresAt,
  });
  const payload = `${id}.${expiresAt}.${userId}`;
  const sig = createHmac("sha256", challengeKey())
    .update(payload)
    .digest("base64url");
  return {
    nonce: `${payload}.${sig}`,
    expiresInSeconds: Math.floor(CHALLENGE_TTL_MS / 1000),
  };
}

/**
 * Validate and consume a previously-issued challenge nonce. Returns
 * the bound userId on success; null when the nonce is unknown,
 * expired, malformed, tampered with, or already used.
 */
export function consumeLoginChallenge(nonce: string): string | null {
  if (typeof nonce !== "string") return null;
  const lastDot = nonce.lastIndexOf(".");
  if (lastDot < 0) return null;
  const payload = nonce.slice(0, lastDot);
  const sig = nonce.slice(lastDot + 1);
  const expected = createHmac("sha256", challengeKey())
    .update(payload)
    .digest("base64url");
  let sigOk = false;
  try {
    const a = Buffer.from(sig, "base64url");
    const b = Buffer.from(expected, "base64url");
    sigOk = a.length === b.length && timingSafeEqual(a, b);
  } catch {
    sigOk = false;
  }
  if (!sigOk) return null;

  const [id, expStr, userId] = payload.split(".");
  if (!id || !expStr || !userId) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= Date.now()) return null;

  const rec = pending.get(id);
  if (!rec) return null;
  pending.delete(id); // single-use
  if (rec.userId !== userId) return null;
  if (rec.expiresAt <= Date.now()) return null;
  return userId;
}

/* ─────────── IP geolocation (best-effort) ─────────── */

/**
 * Look up coarse city/country for an IP address using ip-api.com's
 * free, no-key endpoint. Best-effort: any failure returns
 * { city: null, country: null }. Cached in-memory for 24h to avoid
 * hammering the upstream service.
 */
export async function lookupCity(
  ip: string,
): Promise<{ city: string | null; country: string | null }> {
  gcGeo();
  const prefix = ipPrefix(ip);
  if (!prefix) return { city: null, country: null };
  // Skip private and reserved ranges — geo lookups for them are
  // useless and slow.
  if (
    /^10\./.test(prefix) ||
    /^192\.168/.test(prefix) ||
    /^172\.(1[6-9]|2\d|3[0-1])/.test(prefix) ||
    /^127\./.test(prefix) ||
    prefix === "0.0.0" ||
    prefix.startsWith("fc") ||
    prefix.startsWith("fd") ||
    prefix.startsWith("fe80") ||
    prefix === "::1"
  ) {
    return { city: null, country: null };
  }

  const cacheKey = prefix;
  const cached = geoCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { city: cached.city, country: cached.country };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), GEO_LOOKUP_TIMEOUT_MS);
  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,city,country`,
      { signal: ctrl.signal },
    );
    if (!res.ok) throw new Error(`http ${res.status}`);
    const data = (await res.json()) as {
      status?: string;
      city?: string;
      country?: string;
    };
    if (data.status !== "success") {
      const out = { city: null, country: null };
      geoCache.set(cacheKey, { ...out, expiresAt: Date.now() + GEO_CACHE_TTL_MS });
      return out;
    }
    const out = {
      city: data.city ?? null,
      country: data.country ?? null,
    };
    geoCache.set(cacheKey, { ...out, expiresAt: Date.now() + GEO_CACHE_TTL_MS });
    return out;
  } catch {
    return { city: null, country: null };
  } finally {
    clearTimeout(timer);
  }
}
