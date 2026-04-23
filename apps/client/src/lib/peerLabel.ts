import type { Peer } from "@veil/shared";

/**
 * Best human label for a peer in chat lists / headers.
 * Preference: displayName → @username → fingerprint → truncated id.
 */
export function peerLabel(peer: Pick<Peer, "id" | "fingerprint"> & {
  username?: string | null;
  displayName?: string | null;
  contactName?: string | null;
}): string {
  const cn = peer.contactName?.trim();
  if (cn) return cn;
  if (peer.username) return `@${peer.username}`;
  const dn = peer.displayName?.trim();
  if (dn) return dn;
  if (peer.fingerprint) return peer.fingerprint;
  return `${peer.id.slice(0, 8)}…`;
}

/**
 * Optional secondary line: shows @username under the displayName, or
 * the short fingerprint when only a username is available.
 */
export function peerSubLabel(peer: Pick<Peer, "id" | "fingerprint"> & {
  username?: string | null;
  displayName?: string | null;
}): string | null {
  const dn = peer.displayName?.trim();
  if (dn && peer.username) return `@${peer.username}`;
  if (dn && peer.fingerprint) return peer.fingerprint;
  if (!dn && peer.username && peer.fingerprint) return peer.fingerprint;
  return null;
}
