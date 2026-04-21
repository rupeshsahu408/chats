import { randomBytes } from "node:crypto";

/**
 * Generate a URL-safe invite token. 18 bytes → 24 base64url chars,
 * giving ~144 bits of entropy. Plenty for unguessable invite links.
 */
export function generateInviteToken(): string {
  return randomBytes(18)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

/**
 * Format the token for display in URLs. Currently identical to the raw
 * token, but kept as a function so we can change framing later.
 */
export function inviteUrlPath(token: string): string {
  return `/i/${token}`;
}
