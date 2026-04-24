import { create } from "zustand";

/**
 * In-memory bridge between the WebSocket pump (`SessionSync`) and the
 * `SessionGuard` modal coordinator. We keep this small and explicit
 * — single counters that bump every time something interesting
 * arrives — so the guard can re-fetch fresh data from tRPC on its
 * own terms, rather than us trying to ferry whole records through.
 *
 * The "tick" pattern means the guard's `useEffect` deps stay simple
 * (`[pendingTick]`), without us having to worry about deduping
 * payloads or re-computing equality.
 */
interface SessionEventsState {
  /** Bumped on every `login_request_pending` push. */
  pendingTick: number;
  /** Bumped on every `login_request_resolved` push. */
  resolvedTick: number;
  /** Bumped on every `security_alert` push. */
  alertTick: number;
  /** Bumped on every `session_revoked` push. */
  revokedTick: number;

  bumpPending: () => void;
  bumpResolved: () => void;
  bumpAlert: () => void;
  bumpRevoked: () => void;
}

export const useSessionEventsStore = create<SessionEventsState>((set) => ({
  pendingTick: 0,
  resolvedTick: 0,
  alertTick: 0,
  revokedTick: 0,
  bumpPending: () => set((s) => ({ pendingTick: s.pendingTick + 1 })),
  bumpResolved: () => set((s) => ({ resolvedTick: s.resolvedTick + 1 })),
  bumpAlert: () => set((s) => ({ alertTick: s.alertTick + 1 })),
  bumpRevoked: () => set((s) => ({ revokedTick: s.revokedTick + 1 })),
}));
