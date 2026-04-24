import { create } from "zustand";

/**
 * In-memory bridge between the WebSocket pump (`SessionSync`) and the
 * `SessionGuard` modal coordinator. We keep this small and explicit
 * — single counters that bump every time something interesting
 * arrives — so the guard can re-fetch fresh data from tRPC on its
 * own terms, rather than us trying to ferry whole records through.
 *
 * The "tick" pattern means the guard's `useEffect` deps stay simple
 * (`[alertTick]`), without us having to worry about deduping
 * payloads or re-computing equality.
 */
type RevokeReason = "replaced_by_new_device" | "secured" | "manual";

interface SessionEventsState {
  /** Bumped on every `security_alert` push. */
  alertTick: number;
  /** Bumped on every `session_revoked` push. */
  revokedTick: number;
  /**
   * Reason from the most recent `session_revoked` push. Lets the
   * guard pick a slightly different toast based on *why* we're being
   * signed out.
   */
  lastRevokedReason: RevokeReason | null;

  bumpAlert: () => void;
  bumpRevoked: (reason: RevokeReason) => void;
}

export const useSessionEventsStore = create<SessionEventsState>((set) => ({
  alertTick: 0,
  revokedTick: 0,
  lastRevokedReason: null,
  bumpAlert: () => set((s) => ({ alertTick: s.alertTick + 1 })),
  bumpRevoked: (reason) =>
    set((s) => ({
      revokedTick: s.revokedTick + 1,
      lastRevokedReason: reason,
    })),
}));
