import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Logo } from "../components/Layout";
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
    <main className="min-h-full flex flex-col items-center justify-center px-6 py-10 bg-gradient-to-b from-midnight-deep via-midnight to-midnight-deep">
      <div className="w-full max-w-md flex flex-col items-center text-center gap-8">
        <Logo size={80} />
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">Veil</h1>
          <p className="mt-2 text-white/70">
            Private by design. Visible to no one but you.
          </p>
        </div>

        <div className="w-full grid gap-3">
          <p className="text-xs uppercase tracking-widest text-white/40 mb-1">
            Choose your sign-up method
          </p>
          <SignupOption
            to="/signup/email"
            title="Email"
            sub="6-digit code to your inbox"
            available
          />
          <SignupOption
            to="/signup/phone"
            title="Phone"
            sub={
              firebaseReady
                ? "SMS verification"
                : "SMS verification · requires Firebase setup"
            }
            available={firebaseReady}
            comingSoon={!firebaseReady}
          />
          <SignupOption
            to="/signup/random"
            title="Random ID + recovery phrase"
            sub="No email, no phone — maximum privacy"
            available
          />
        </div>

        <Link to="/login" className="text-sm text-accent-soft hover:text-white">
          I already have an account
        </Link>

        <ServerStatusBadge status={status} />

        <p className="text-xs text-white/40 mt-2 leading-relaxed">
          End-to-end encrypted · Open source · No ads · No tracking
        </p>
      </div>
    </main>
  );
}

function SignupOption({
  to,
  title,
  sub,
  available,
  comingSoon,
}: {
  to: string;
  title: string;
  sub: string;
  available?: boolean;
  comingSoon?: boolean;
}) {
  const inner = (
    <div className="w-full text-left rounded-xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10 transition flex items-center justify-between">
      <div>
        <div className="font-medium flex items-center gap-2">
          {title}
          {comingSoon && (
            <span className="text-[10px] bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded-full">
              setup needed
            </span>
          )}
        </div>
        <div className="text-xs text-white/50">{sub}</div>
      </div>
      <span className="text-white/40">→</span>
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
      <div className="flex items-center gap-2 text-xs text-white/50">
        <span className="size-2 rounded-full bg-white/30 animate-pulse" />
        Checking server…
      </div>
    );
  }
  if (status.kind === "ok") {
    return (
      <div className="flex items-center gap-2 text-xs text-emerald-400/90">
        <span className="size-2 rounded-full bg-emerald-400" />
        Server online
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-xs text-red-400">
      <span className="size-2 rounded-full bg-red-400" />
      Server unreachable: {status.message}
    </div>
  );
}
