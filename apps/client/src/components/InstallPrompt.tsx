import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "veil:install-prompt:dismissed-at";
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!isIos) return false;
  // Exclude in-app browsers (FB, IG, etc.) that can't add to home screen reliably.
  if (/CriOS|FxiOS|EdgiOS|GSA|FBAN|FBAV|Instagram|Line|OKApp/.test(ua)) {
    return false;
  }
  return /Safari/.test(ua);
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

function markDismissed(): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* localStorage may be blocked — fall through */
  }
}

export function InstallPrompt() {
  const [bipEvent, setBipEvent] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [showIosSheet, setShowIosSheet] = useState(false);
  const [showIosBanner, setShowIosBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (dismissedRecently()) {
      setDismissed(true);
      return;
    }

    const onBip = (e: Event) => {
      e.preventDefault();
      setBipEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setBipEvent(null);
      setShowIosBanner(false);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);

    if (isIosSafari()) {
      // Slight delay so it doesn't slam in on first paint.
      const t = window.setTimeout(() => setShowIosBanner(true), 1500);
      return () => {
        window.clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", onBip);
        window.removeEventListener("appinstalled", onInstalled);
      };
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (dismissed) return null;
  if (isStandalone()) return null;

  function handleDismiss() {
    markDismissed();
    setDismissed(true);
  }

  async function handleAndroidInstall() {
    if (!bipEvent) return;
    try {
      await bipEvent.prompt();
      const choice = await bipEvent.userChoice;
      if (choice.outcome === "accepted") {
        setBipEvent(null);
      } else {
        handleDismiss();
      }
    } catch {
      handleDismiss();
    }
  }

  // Android / desktop Chrome: native install banner.
  if (bipEvent) {
    return (
      <Banner
        title="Install Veil"
        body="Add Veil to your home screen for a faster, app-like experience."
        primaryLabel="Install"
        onPrimary={handleAndroidInstall}
        onDismiss={handleDismiss}
      />
    );
  }

  // iOS Safari: instruction sheet trigger.
  if (showIosBanner) {
    return (
      <>
        <Banner
          title="Add Veil to your Home Screen"
          body="Tap the Share icon, then “Add to Home Screen” to install Veil."
          primaryLabel="Show me how"
          onPrimary={() => setShowIosSheet(true)}
          onDismiss={handleDismiss}
        />
        {showIosSheet && (
          <IosInstructionsSheet onClose={() => setShowIosSheet(false)} />
        )}
      </>
    );
  }

  return null;
}

function Banner({
  title,
  body,
  primaryLabel,
  onPrimary,
  onDismiss,
}: {
  title: string;
  body: string;
  primaryLabel: string;
  onPrimary: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-label={title}
      className="fixed left-2 right-2 bottom-2 sm:left-auto sm:right-4 sm:bottom-4 sm:max-w-sm z-50 bg-panel text-text border border-line rounded-xl shadow-lg p-3 flex items-start gap-3"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-brand/15 flex items-center justify-center text-brand">
        <PhoneIcon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight">{title}</p>
        <p className="text-xs text-text-muted mt-0.5 leading-snug">{body}</p>
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={onPrimary}
            className="px-3 py-1.5 rounded-md bg-brand text-text-oncolor text-xs font-medium hover:opacity-90"
          >
            {primaryLabel}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="px-3 py-1.5 rounded-md text-xs text-text-muted hover:text-text"
          >
            Not now
          </button>
        </div>
      </div>
      <button
        type="button"
        aria-label="Dismiss install prompt"
        onClick={onDismiss}
        className="flex-shrink-0 -mr-1 -mt-1 w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-text"
      >
        <CloseIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

function IosInstructionsSheet({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add Veil to Home Screen"
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative w-full sm:max-w-md bg-panel text-text border-t sm:border border-line sm:rounded-2xl rounded-t-2xl shadow-2xl p-5"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Add Veil to Home Screen</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md text-text-muted hover:text-text"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-text-muted mb-4">
          Veil works best installed. It's a one-time, three-step setup in
          Safari:
        </p>
        <ol className="space-y-3 text-sm">
          <Step n={1}>
            Tap the{" "}
            <span className="inline-flex items-center gap-1 align-middle">
              <ShareIcon className="w-4 h-4 inline" />
              <span className="font-medium">Share</span>
            </span>{" "}
            icon at the bottom of Safari.
          </Step>
          <Step n={2}>
            Scroll and tap{" "}
            <span className="font-medium">"Add to Home Screen"</span>.
          </Step>
          <Step n={3}>
            Tap <span className="font-medium">Add</span> in the top right.
            Open Veil from your Home Screen for push notifications and
            offline support.
          </Step>
        </ol>
        <div className="mt-5 text-[11px] text-text-muted leading-relaxed">
          Note: this only works in Safari. If you opened this link from
          another app (Instagram, Facebook, etc.), tap the menu and choose
          "Open in Safari" first.
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full px-4 py-2 rounded-md bg-brand text-text-oncolor text-sm font-medium hover:opacity-90"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand/15 text-brand text-xs font-semibold flex items-center justify-center">
        {n}
      </span>
      <span className="flex-1 leading-snug">{children}</span>
    </li>
  );
}

function PhoneIcon({ className }: { className?: string }) {
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
      <rect x="6" y="2" width="12" height="20" rx="2.5" />
      <line x1="11" y1="18" x2="13" y2="18" />
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

function ShareIcon({ className }: { className?: string }) {
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
      <path d="M12 3v12" />
      <path d="m8 7 4-4 4 4" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}
