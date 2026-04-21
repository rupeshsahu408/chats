import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function ScreenShell({
  children,
  back,
  phase,
}: {
  children: ReactNode;
  back?: string;
  phase?: string;
}) {
  return (
    <main className="min-h-full flex flex-col px-6 py-8 bg-gradient-to-b from-midnight-deep via-midnight to-midnight-deep">
      <header className="flex items-center justify-between mb-6">
        {back ? (
          <Link
            to={back}
            className="text-white/60 hover:text-white text-sm flex items-center gap-1"
          >
            <span aria-hidden>←</span> Back
          </Link>
        ) : (
          <span />
        )}
        {phase && (
          <span className="text-[10px] uppercase tracking-widest text-accent-soft/80">
            {phase}
          </span>
        )}
      </header>
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-full max-w-md flex flex-col gap-6">{children}</div>
      </div>
    </main>
  );
}

export function Logo({ size = 56 }: { size?: number }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-2xl bg-gradient-to-br from-accent to-midnight flex items-center justify-center shadow-xl shadow-accent/30"
    >
      <svg viewBox="0 0 64 64" className="size-3/5" aria-hidden="true">
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

export function PrimaryButton({
  children,
  loading,
  ...props
}: {
  children: ReactNode;
  loading?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={
        "w-full rounded-xl bg-accent px-5 py-3 font-medium text-white shadow-lg shadow-accent/20 hover:bg-accent-soft transition disabled:opacity-50 disabled:cursor-not-allowed " +
        (props.className ?? "")
      }
    >
      {loading ? "Working…" : children}
    </button>
  );
}

export function SecondaryButton({
  children,
  ...props
}: {
  children: ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={
        "w-full rounded-xl border border-white/15 bg-white/5 px-5 py-3 font-medium text-white hover:bg-white/10 transition disabled:opacity-50 " +
        (props.className ?? "")
      }
    >
      {children}
    </button>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="block text-xs uppercase tracking-wider text-white/50 mb-2">
      {children}
    </label>
  );
}

export function ErrorMessage({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-200">
      {children}
    </div>
  );
}

export function InfoMessage({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div className="rounded-lg bg-accent/10 border border-accent/30 px-3 py-2 text-sm text-accent-soft">
      {children}
    </div>
  );
}
