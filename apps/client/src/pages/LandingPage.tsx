import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchHealth } from "../api";

type ServerStatus =
  | { kind: "loading" }
  | { kind: "ok"; service: string; version: string }
  | { kind: "error"; message: string };

export function LandingPage() {
  const [status, setStatus] = useState<ServerStatus>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetchHealth()
      .then((r) => {
        if (cancelled) return;
        setStatus({ kind: "ok", service: r.service, version: r.version });
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus({ kind: "error", message: String(err?.message ?? err) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-full flex flex-col items-center justify-center px-6 py-10 bg-gradient-to-b from-midnight-deep via-midnight to-midnight-deep">
      <div className="w-full max-w-md flex flex-col items-center text-center gap-8">
        <Logo />

        <div>
          <h1 className="text-4xl font-semibold tracking-tight">Veil</h1>
          <p className="mt-2 text-white/70">
            Private by design. Visible to no one but you.
          </p>
        </div>

        <div className="w-full grid gap-3">
          <Link
            to="/signup"
            className="w-full rounded-xl bg-accent px-5 py-3 font-medium text-white shadow-lg shadow-accent/20 hover:bg-accent-soft transition"
          >
            Create account
          </Link>
          <Link
            to="/login"
            className="w-full rounded-xl border border-white/15 bg-white/5 px-5 py-3 font-medium text-white hover:bg-white/10 transition"
          >
            I already have an account
          </Link>
        </div>

        <ServerStatusBadge status={status} />

        <p className="text-xs text-white/40 mt-6 leading-relaxed">
          End-to-end encrypted · Open source · No ads · No tracking
        </p>
      </div>
    </main>
  );
}

function Logo() {
  return (
    <div className="size-20 rounded-3xl bg-gradient-to-br from-accent to-midnight flex items-center justify-center shadow-2xl shadow-accent/30">
      <svg viewBox="0 0 64 64" className="size-12" aria-hidden="true">
        <path
          d="M32 14 L48 24 V36 C48 44 40 50 32 52 C24 50 16 44 16 36 V24 Z"
          fill="none"
          stroke="white"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <circle cx="32" cy="33" r="4" fill="white" />
      </svg>
    </div>
  );
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
        {status.service} v{status.version} online
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
