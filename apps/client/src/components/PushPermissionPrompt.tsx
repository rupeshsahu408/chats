import { useEffect, useState } from "react";
import { useAuthStore } from "../lib/store";
import { ensurePushSubscription } from "../lib/push";

const DISMISS_KEY = "veil:push-prompt:dismissed-at";
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const SHOW_DELAY_MS = 2500;

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function dismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const when = Number.parseInt(raw, 10);
    if (Number.isNaN(when)) return false;
    return Date.now() - when < DISMISS_COOLDOWN_MS;
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function PushPermissionPrompt() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    if (!isStandalone()) return;
    if (!pushSupported()) return;
    if (Notification.permission !== "default") return;
    if (dismissedRecently()) return;

    const t = window.setTimeout(() => setShow(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [accessToken]);

  if (hidden || !show) return null;

  function handleDismiss() {
    markDismissed();
    setHidden(true);
  }

  async function handleEnable() {
    setBusy(true);
    try {
      const r = await ensurePushSubscription({ requestPermission: true });
      // Whatever the outcome, hide the banner. Settings → Notifications
      // remains the place to retry / inspect.
      if (r.state !== "ok") markDismissed();
      setHidden(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-label="Enable notifications"
      className="fixed left-2 right-2 bottom-2 sm:left-auto sm:right-4 sm:bottom-4 sm:max-w-sm md:max-w-md z-50 bg-panel text-text border border-line rounded-xl shadow-lg p-3 flex items-start gap-3"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-brand/15 flex items-center justify-center text-brand">
        <BellIcon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight">
          Get notified of new messages
        </p>
        <p className="text-xs text-text-muted mt-0.5 leading-snug">
          VeilChat only ever shows "New message" — the actual content is decrypted
          on this device when you open the app.
        </p>
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={handleEnable}
            disabled={busy}
            className="px-3 py-1.5 rounded-md bg-brand text-text-oncolor text-xs font-medium hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Enabling…" : "Enable"}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            disabled={busy}
            className="px-3 py-1.5 rounded-md text-xs text-text-muted hover:text-text disabled:opacity-60"
          >
            Not now
          </button>
        </div>
      </div>
      <button
        type="button"
        aria-label="Dismiss notifications prompt"
        onClick={handleDismiss}
        className="flex-shrink-0 -mr-1 -mt-1 w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-text"
      >
        <CloseIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
