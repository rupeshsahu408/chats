import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Logo,
  PrimaryButton,
  ChevronRightIcon,
  LockIcon,
} from "../components/Layout";
import { fetchHealth } from "../api";
import { isFirebaseConfigured } from "../lib/firebase";

type ServerStatus =
  | { kind: "loading" }
  | { kind: "ok" }
  | { kind: "error"; message: string };

export function WelcomePage() {
  const [status, setStatus] = useState<ServerStatus>({ kind: "loading" });
  const firebaseReady = isFirebaseConfigured();

  useEffect(() => {
    let cancelled = false;
    fetchHealth()
      .then(() => !cancelled && setStatus({ kind: "ok" }))
      .catch(
        (e) =>
          !cancelled &&
          setStatus({ kind: "error", message: String(e?.message ?? e) }),
      );
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-full flex flex-col bg-bg text-text">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm flex flex-col items-center text-center gap-6">
          <Logo size={96} />
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Veil</h1>
            <p className="mt-2 text-sm text-text-muted">
              Simple. Reliable. Private.
            </p>
          </div>

          <p className="inline-flex items-center gap-1.5 text-xs text-text-muted">
            <LockIcon /> End-to-end encrypted
          </p>

          <div className="w-full flex flex-col gap-3 mt-2">
            <p className="text-[11px] uppercase tracking-widest text-text-muted">
              Choose how to sign up
            </p>
            <SignupOption
              to="/signup/phone"
              title="Phone number"
              sub={
                firebaseReady
                  ? "SMS verification"
                  : "Requires Firebase setup"
              }
              available={firebaseReady}
            />
            <SignupOption
              to="/signup/email"
              title="Email"
              sub="6-digit code to your inbox"
              available
            />
            <SignupOption
              to="/signup/random"
              title="Random ID + recovery phrase"
              sub="Maximum privacy — no email or phone"
              available
            />
          </div>

          <Link
            to="/login"
            className="text-sm text-wa-green-dark dark:text-wa-green hover:underline mt-2"
          >
            I already have an account
          </Link>

          <ServerStatusBadge status={status} />
        </div>
      </div>

      <footer className="px-6 py-4 text-center text-[11px] text-text-faint">
        Open source · No ads · No tracking
      </footer>
    </main>
  );
}

function SignupOption({
  to,
  title,
  sub,
  available,
}: {
  to: string;
  title: string;
  sub: string;
  available?: boolean;
}) {
  const inner = (
    <div className="w-full text-left rounded-xl bg-surface border border-line px-4 py-3 hover:bg-elevated transition flex items-center justify-between gap-3 wa-tap">
      <div className="min-w-0">
        <div className="font-medium text-text">{title}</div>
        <div className="text-xs text-text-muted truncate">{sub}</div>
      </div>
      <ChevronRightIcon className="text-text-muted shrink-0" />
    </div>
  );
  if (!available) {
    return (
      <div className="opacity-50 pointer-events-none select-none">{inner}</div>
    );
  }
  return <Link to={to}>{inner}</Link>;
}

function ServerStatusBadge({ status }: { status: ServerStatus }) {
  if (status.kind === "loading") {
    return (
      <div className="flex items-center gap-2 text-[11px] text-text-muted">
        <span className="size-2 rounded-full bg-text-muted animate-pulse" />
        Checking server…
      </div>
    );
  }
  if (status.kind === "ok") {
    return (
      <div className="flex items-center gap-2 text-[11px] text-wa-green-dark dark:text-wa-green">
        <span className="size-2 rounded-full bg-wa-green" />
        Server online
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-[11px] text-red-500">
      <span className="size-2 rounded-full bg-red-500" />
      Server unreachable: {status.message}
    </div>
  );
}

// Re-export so Layout's default `PrimaryButton` symbol stays imported here too
// (no-op for tree-shaking; useful when wiring future CTAs).
export { PrimaryButton };
