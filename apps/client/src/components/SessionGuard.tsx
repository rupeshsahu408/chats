import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SecurityAlertEntry } from "@veil/shared";
import { useAuthStore } from "../lib/store";
import { useSessionEventsStore } from "../lib/sessionEventsStore";
import { useUnlockStore } from "../lib/unlockStore";
import { trpcClientProxy } from "../lib/trpcClientProxy";
import { toast } from "../lib/toast";
import { SecurityAlertModal } from "./SecurityAlertModal";

/**
 * App-wide coordinator for the post-login security UI.
 *
 * Under the "new device decides" model the *existing* device no
 * longer has any decision to make about an incoming login — the new
 * device either takes over (and we get a `session_revoked` push) or
 * declines and posts a security alert. So this component now only
 * needs to handle:
 *
 *   1. Security-alert prompts (`rejected_login_attempt`,
 *      `account_secured`), refreshed both on WS push and a 20s
 *      timer in case the WS missed it.
 *
 *   2. `session_revoked` pushes — verify our session row still
 *      exists; if not, clear local auth and show a calm toast
 *      explaining what happened (slightly different copy depending
 *      on the reason, e.g. "signed in on another device" vs
 *      "you secured this account").
 *
 * Renders nothing when signed out.
 */
export function SessionGuard() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const clearUnlock = useUnlockStore((s) => s.clear);

  const alertTick = useSessionEventsStore((s) => s.alertTick);
  const revokedTick = useSessionEventsStore((s) => s.revokedTick);

  const [alerts, setAlerts] = useState<SecurityAlertEntry[]>([]);
  // Track which alert IDs the user already acted on locally so a
  // stale poll round doesn't briefly re-show the same modal.
  const handledRef = useRef<Set<string>>(new Set());

  const refreshAlerts = useCallback(async () => {
    if (!useAuthStore.getState().accessToken) return;
    try {
      const list = await trpcClientProxy().auth.listSecurityAlerts.query();
      setAlerts(list.filter((a) => !handledRef.current.has(a.id)));
    } catch {
      /* network blip — try again on next tick */
    }
  }, []);

  // Initial fetch + 20s polling fallback whenever signed-in.
  useEffect(() => {
    if (!accessToken) {
      setAlerts([]);
      handledRef.current = new Set();
      return;
    }
    void refreshAlerts();
    const t = setInterval(() => {
      void refreshAlerts();
    }, 20_000);
    return () => clearInterval(t);
  }, [accessToken, refreshAlerts]);

  // WS-driven refresh.
  useEffect(() => {
    if (!accessToken) return;
    void refreshAlerts();
  }, [alertTick, accessToken, refreshAlerts]);

  // session_revoked: verify our own session is still alive; if not,
  // wipe local auth + bounce to the login page. Tailor the toast to
  // the reason we got from the WS payload.
  useEffect(() => {
    if (!accessToken) return;
    if (revokedTick === 0) return;
    const reason = useSessionEventsStore.getState().lastRevokedReason;
    let cancelled = false;
    (async () => {
      try {
        const status =
          await trpcClientProxy().auth.checkSessionStatus.query();
        if (cancelled) return;
        if (!status.active) {
          clearAuth();
          await clearUnlock().catch(() => undefined);
          const message =
            reason === "replaced_by_new_device"
              ? "Signed out — you (or someone) just signed in on another device."
              : reason === "secured"
                ? "Signed out — this account was secured. Please sign in again."
                : "You were signed out from another device.";
          toast.warning(message, { duration: 6000 });
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

  // Periodic liveness check (every 60s) so a missed WS push
  // doesn't keep us pretending to be signed in indefinitely.
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
