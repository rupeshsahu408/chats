import { useState } from "react";
import type { SecurityAlertEntry } from "@veil/shared";
import { trpc } from "../lib/trpc";
import { toast } from "../lib/toast";

interface Props {
  alert: SecurityAlertEntry;
  onResolved: () => void;
}

/**
 * Sheet shown after a rejected sign-in attempt (or after we're told
 * an account was secured). Two actions:
 *
 *   - "It was me, dismiss" — just acknowledge, no further action.
 *   - "Secure my account"  — sign out everywhere AND require a fresh
 *                            password on next sign-in. Server takes
 *                            care of revoking sessions + flipping the
 *                            `requirePasswordChange` flag.
 */
export function SecurityAlertModal({ alert, onResolved }: Props) {
  const ack = trpc.auth.acknowledgeSecurityAlert.useMutation();
  const [busy, setBusy] = useState<"dismiss" | "secure" | null>(null);

  async function decide(action: "dismiss" | "secure") {
    if (busy) return;
    setBusy(action);
    try {
      await ack.mutateAsync({ alertId: alert.id, action });
      onResolved();
      if (action === "secure") {
        toast.success(
          "Your account is secured. We'll ask for a new password the next time you sign in.",
          { duration: 6000 },
        );
      } else {
        toast.info("Got it — alert dismissed.");
      }
    } catch (e) {
      toast.error(e, { title: "Couldn't update that alert" });
      setBusy(null);
    }
  }

  const place = [alert.city, alert.country].filter(Boolean).join(", ");
  const isSecuredAlert = alert.kind === "account_secured";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-3 pb-4 sm:p-6"
    >
      <div className="w-full max-w-md rounded-3xl bg-bg border border-line shadow-2xl overflow-hidden">
        <div className="px-6 pt-6 pb-4 text-center border-b border-line bg-rose-500/5">
          <div className="mx-auto w-14 h-14 rounded-full bg-rose-500/15 border border-rose-500/40 flex items-center justify-center mb-3">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-3Zm0 6v4m0 3v.01"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-rose-600 dark:text-rose-400"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold">
            {isSecuredAlert
              ? "Your account was secured"
              : "Suspicious sign-in attempt"}
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            {isSecuredAlert
              ? "Every device was signed out. You'll choose a new password the next time you sign in."
              : "Someone tried to sign in to your account, and you (or this device) denied it."}
          </p>
        </div>

        {!isSecuredAlert ? (
          <dl className="px-6 py-4 grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-text-muted">Device</dt>
            <dd className="text-text font-medium">
              {alert.device ?? "Unknown device"}
            </dd>
            {place ? (
              <>
                <dt className="text-text-muted">Approx. location</dt>
                <dd className="text-text">{place}</dd>
              </>
            ) : null}
            <dt className="text-text-muted">When</dt>
            <dd className="text-text">{formatDate(alert.at)}</dd>
          </dl>
        ) : (
          <div className="px-6 py-4 text-sm text-text-muted">
            All sessions for your account have been ended. You can dismiss
            this notice once you&apos;ve seen it.
          </div>
        )}

        <div className="px-6 pb-6 grid gap-2">
          {!isSecuredAlert ? (
            <button
              type="button"
              onClick={() => decide("secure")}
              disabled={!!busy}
              className="w-full px-4 py-3 rounded-xl bg-rose-600 text-white font-semibold hover:bg-rose-500 transition disabled:opacity-60 wa-tap"
            >
              {busy === "secure"
                ? "Securing…"
                : "It wasn't me — secure my account"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => decide("dismiss")}
            disabled={!!busy}
            className="w-full px-4 py-3 rounded-xl border border-line bg-surface text-text font-semibold hover:bg-white/5 transition disabled:opacity-60 wa-tap"
          >
            {busy === "dismiss"
              ? "Dismissing…"
              : isSecuredAlert
                ? "Got it"
                : "It was me — dismiss"}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return iso;
  const diffSec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
  if (diffSec < 86_400) return `${Math.floor(diffSec / 3600)} hr ago`;
  return new Date(iso).toLocaleString();
}
