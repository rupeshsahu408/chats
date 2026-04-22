/**
 * Helpers for the "open invite link → sign up → land back on the invite"
 * round-trip. The token is stashed in sessionStorage on the InviteRedeem
 * page; every signup/login flow reads it on completion and routes back.
 */

const KEY = "veil:pending_invite";

export function readPendingInvite(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearPendingInvite(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function stashPendingInvite(token: string): void {
  try {
    sessionStorage.setItem(KEY, token);
  } catch {
    /* ignore */
  }
}

/**
 * Returns the path the user should land on after authenticating.
 * Pops the pending invite (if any) so we don't redirect twice.
 */
export function postAuthLandingPath(fallback = "/chats"): string {
  const pending = readPendingInvite();
  if (pending) {
    clearPendingInvite();
    return `/i/${encodeURIComponent(pending)}`;
  }
  return fallback;
}
