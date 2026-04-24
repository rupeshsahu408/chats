import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type {
  PendingLoginRequestEntry,
  SecurityAlertEntry,
} from "@veil/shared";
import { useAuthStore } from "../lib/store";
import { useSessionEventsStore } from "../lib/sessionEventsStore";
import { useUnlockStore } from "../lib/unlockStore";
import { trpcClientProxy } from "../lib/trpcClientProxy";
import { toast } from "../lib/toast";
import { IncomingLoginRequestModal } from "./IncomingLoginRequestModal";
import { SecurityAlertModal } from "./SecurityAlertModal";

/**
 * App-wide coordinator for the single-active-session login flow.
 *
 * Responsibilities:
 *
 *   1. Show the "is this you?" prompt whenever a different device
 *      tries to sign in to this account. Source of truth is
 *      `auth.listPendingLoginRequests`, refreshed both on WS push
 *      and on a 20s timer (in case the WS missed it).
 *
 *   2. Show the security-alert prompt whenever there's an
 *      unacknowledged alert (rejected_login_attempt /
 *      account_secured), again WS-pushed + polled.
 *
 *   3. React to `session_revoked` pushes by checking whether *our*
 *      session row still exists — if not, clear local auth and
 *      show a calm "signed out from another device" toast.
 *
 * Renders nothing when signed out — every effect early-returns
 * unless we have an access token.
 */
export function SessionGuard() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const clearUnlock = useUnlockStore((s) => s.clear);

  const pendingTick = useSessionEventsStore((s) => s.pendingTick);
  const resolvedTick = useSessionEventsStore((s) => s.resolvedTick);
  const alertTick = useSessionEventsStore((s) => s.alertTick);
  const revokedTick = useSessionEventsStore((s) => s.revokedTick);

  const [pending, setPending] = useState<PendingLoginRequestEntry[]>([]);
  const [alerts, setAlerts] = useState<SecurityAlertEntry[]>([]);
  // Track which conflict / alert IDs the user has already acted on
  // locally, so a stale poll round doesn't briefly re-show a modal
  // we just dismissed.
  const handledRef = useRef<Set<string>>(new Set());

  const refreshPending = useCallback(async () => {
    if (!useAuthStore.getState().accessToken) return;
    try {
      const list =
        await trpcClientProxy().auth.listPendingLoginRequests.query();
      setPending(list.filter((r) => !handledRef.current.has(r.id)));
    } catch {
      /* network blip — try again on next tick */
    }
  }, []);

  const refreshAlerts = useCallback(async () => {
    if (!useAuthStore.getState().accessToken) return;
    try {
      const list = await trpcClientProxy().auth.listSecurityAlerts.query();
      setAlerts(list.filter((a) => !handledRef.current.has(a.id)));
    } catch {
      /* network blip */
    }
  }, []);

  // Initial fetch + polling fallback whenever signed-in.
  useEffect(() => {
    if (!accessToken) {
      setPending([]);
      setAlerts([]);
      handledRef.current = new Set();
      return;
    }
    void refreshPending();
    void refreshAlerts();
    const t = setInterval(() => {
      void refreshPending();
      void refreshAlerts();
    }, 20_000);
    return () => clearInterval(t);
  }, [accessToken, refreshPending, refreshAlerts]);

  // WS-driven refreshes.
  useEffect(() => {
    if (!accessToken) return;
    void refreshPending();
  }, [pendingTick, resolvedTick, accessToken, refreshPending]);

  useEffect(() => {
    if (!accessToken) return;
    void refreshAlerts();
  }, [alertTick, accessToken, refreshAlerts]);

  // session_revoked: verify our own session is still alive; if not,
  // wipe local auth + bounce to the login page.
  useEffect(() => {
    if (!accessToken) return;
    if (revokedTick === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const status =
          await trpcClientProxy().auth.checkSessionStatus.query();
        if (cancelled) return;
        if (!status.active) {
          clearAuth();
          await clearUnlock().catch(() => undefined);
          toast.warning(
            "You were signed out from another device.",
            { duration: 6000 },
          );
          navigate("/login", { replace: true });
        }
      } catch {
        /* ignore — next tick will retry */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [revokedTick, accessToken, clearAuth, clearUnlock, navigate]);

  // Also do a periodic liveness check (every 60s) so a missed WS
  // push doesn't keep us pretending to be signed in indefinitely.
  useEffect(() => {
    if (!accessToken) return;
    const t = setInterval(async () => {
      try {
        const status =
          await trpcClientProxy().auth.checkSessionStatus.query();
        if (!status.active && useAuthStore.getState().accessToken) {
          clearAuth();
          await clearUnlock().catch(() => undefined);
          toast.warning("You were signed out from another device.", {
            duration: 6000,
          });
          navigate("/login", { replace: true });
        }
      } catch {
        /* ignore */
      }
    }, 60_000);
    return () => clearInterval(t);
  }, [accessToken, clearAuth, clearUnlock, navigate]);

  if (!accessToken) return null;

  // Show one modal at a time — pending requests take priority over
  // (potentially older) security alerts.
  const top = pending[0];
  if (top) {
    return (
      <IncomingLoginRequestModal
        request={top}
        onResolved={() => {
          handledRef.current.add(top.id);
          setPending((curr) => curr.filter((r) => r.id !== top.id));
          // Trigger a re-fetch so any second pending request slides
          // up after a beat.
          void refreshPending();
        }}
      />
    );
  }

  const topAlert = alerts[0];
  if (topAlert) {
    return (
      <SecurityAlertModal
        alert={topAlert}
        onResolved={() => {
          handledRef.current.add(topAlert.id);
          setAlerts((curr) => curr.filter((a) => a.id !== topAlert.id));
          void refreshAlerts();
        }}
      />
    );
  }

  return null;
}
