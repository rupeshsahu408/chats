/**
 * In-memory store for WebAuthn registration / authentication
 * challenges. We hand a fresh challenge to the client, the client
 * signs it with the authenticator, then we verify the signed response
 * against the stored challenge before promoting it into a real
 * credential or session.
 *
 * Stored only in-process — challenges are single-use and short-lived
 * (60 s by default), so a node restart at worst forces the user to
 * retry the prompt. No durable storage needed.
 */

const CHALLENGE_TTL_MS = 60_000;
const MAX_ENTRIES = 10_000;

interface Entry {
  challenge: string;
  expiresAt: number;
}

/**
 * Registration challenges are scoped by userId (only the owner of the
 * session can complete their own registration).
 */
const registrationChallenges = new Map<string, Entry>();

/**
 * Authentication challenges are scoped by an opaque session id we
 * hand to the client (since the user isn't logged in yet). The
 * verification mutation echoes the same id back.
 */
const authenticationChallenges = new Map<string, Entry>();

function gc(map: Map<string, Entry>) {
  if (map.size <= MAX_ENTRIES) return;
  const now = Date.now();
  for (const [k, v] of map) {
    if (v.expiresAt <= now) map.delete(k);
  }
}

export function rememberRegistrationChallenge(
  userId: string,
  challenge: string,
) {
  gc(registrationChallenges);
  registrationChallenges.set(userId, {
    challenge,
    expiresAt: Date.now() + CHALLENGE_TTL_MS,
  });
}

/**
 * Returns the stored challenge and removes it (single-use). Returns
 * null if no challenge is pending for this user or it has expired.
 */
export function consumeRegistrationChallenge(userId: string): string | null {
  const entry = registrationChallenges.get(userId);
  if (!entry) return null;
  registrationChallenges.delete(userId);
  if (entry.expiresAt <= Date.now()) return null;
  return entry.challenge;
}

export function rememberAuthenticationChallenge(
  sessionId: string,
  challenge: string,
) {
  gc(authenticationChallenges);
  authenticationChallenges.set(sessionId, {
    challenge,
    expiresAt: Date.now() + CHALLENGE_TTL_MS,
  });
}

export function consumeAuthenticationChallenge(
  sessionId: string,
): string | null {
  const entry = authenticationChallenges.get(sessionId);
  if (!entry) return null;
  authenticationChallenges.delete(sessionId);
  if (entry.expiresAt <= Date.now()) return null;
  return entry.challenge;
}
