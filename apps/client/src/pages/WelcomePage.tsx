import { Link } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
import {
  Logo,
  PrimaryButton,
  ChevronRightIcon,
  LockIcon,
} from "../components/Layout";
import { fetchHealth } from "../api";
import { isFirebaseConfigured } from "../lib/firebase";
import { feedback } from "../lib/feedback";

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
    <main className="min-h-full flex flex-col bg-bg text-text relative overflow-hidden">
      {/* Soft ambient glow behind the logo — adds depth without visual noise. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-32 h-[420px] opacity-[0.55]"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgb(0 168 132 / 0.18), transparent 60%)",
        }}
      />

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 relative z-10">
        <div className="w-full max-w-sm flex flex-col items-center text-center">
          {/* ── Hero ── */}
          <div
            className="animate-slide-up flex flex-col items-center gap-5"
            style={{ animationDelay: "40ms" }}
          >
            <Logo size={88} />
            <div>
              <h1 className="text-[28px] font-semibold tracking-tight leading-tight">
                Welcome to VeilChat
              </h1>
              <p className="mt-2 text-[14px] text-text-muted leading-relaxed">
                Private by design.
                <br />
                Visible to no one but you.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-wa-green-dark dark:text-wa-green/90">
              <LockIcon /> End-to-end encrypted
            </span>
          </div>

          {/* ── Identity choice ── */}
          <div
            className="w-full mt-9 animate-slide-up"
            style={{ animationDelay: "180ms" }}
          >
            <SectionLabel>Make it yours</SectionLabel>
            <FeaturedSignupCard
              to="/signup/random"
              title="Create with a Random ID"
              sub="Maximum privacy — no email or phone. You hold a recovery phrase."
              recommended
            />

            <div className="mt-5">
              <SectionLabel>More ways, soon</SectionLabel>
              <div className="flex flex-col gap-2">
                <ComingSoonOption
                  title="Phone number"
                  sub="SMS verification"
                />
                <ComingSoonOption
                  title="Email"
                  sub="6-digit code to your inbox"
                />
              </div>
            </div>
          </div>

          {/* ── Returning user ── */}
          <Link
            to="/login"
            onClick={() => feedback.tap()}
            className="mt-7 text-[13.5px] font-medium text-wa-green-dark dark:text-wa-green hover:underline animate-fade-in"
            style={{ animationDelay: "320ms" }}
          >
            I already have an account →
          </Link>
        </div>
      </div>

      {/* ── Trust strip — privacy as a feature, not a lecture ── */}
      <div
        className="px-6 pb-5 pt-3 animate-fade-in relative z-10"
        style={{ animationDelay: "440ms" }}
      >
        <div className="mx-auto max-w-md">
          <div
            className={
              "rounded-2xl border border-line/60 bg-surface/60 backdrop-blur-sm " +
              "px-4 py-3 grid grid-cols-3 gap-2"
            }
          >
            <TrustPill icon={<NoAdIcon />} label="No ads, ever" />
            <TrustPill icon={<NoEyeIcon />} label="Zero tracking" />
            <TrustPill icon={<DeviceIcon />} label="Lives on your device" />
          </div>
          <div className="mt-3 flex items-center justify-center gap-3">
            <ServerStatusBadge status={status} />
            <span className="text-text-faint text-[10px]">·</span>
            <Link
              to="/promises"
              onClick={() => feedback.tap()}
              className="text-[10.5px] font-semibold text-wa-green-dark dark:text-wa-green hover:underline"
            >
              Read our promises →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

/* ─────────────────────────── building blocks ─────────────────────────── */

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-faint mb-2.5">
      {children}
    </div>
  );
}

/**
 * Hero-style signup card. Bigger, warmer, and motion-aware so the
 * recommended path feels like the obvious next step rather than one
 * of three equal options.
 */
function FeaturedSignupCard({
  to,
  title,
  sub,
  recommended,
}: {
  to: string;
  title: string;
  sub: string;
  recommended?: boolean;
}) {
  return (
    <Link
      to={to}
      onClick={() => feedback.press()}
      className={
        "group block w-full text-left rounded-2xl " +
        "bg-gradient-to-b from-wa-green/[0.10] to-wa-green/[0.04] " +
        "border border-wa-green/30 " +
        "px-4 py-4 " +
        "shadow-card hover:shadow-glow-accent " +
        "transition-[box-shadow,transform,background-color] duration-200 ease-veil-soft " +
        "active:scale-[0.985] wa-tap"
      }
    >
      <div className="flex items-center gap-3.5">
        <div
          className={
            "size-11 rounded-xl shrink-0 grid place-items-center " +
            "bg-gradient-to-b from-wa-green to-wa-green-dark text-text-oncolor " +
            "[box-shadow:inset_0_1px_0_rgba(255,255,255,0.18),0_2px_6px_rgba(0,168,132,0.28)]"
          }
        >
          <KeyIcon />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[15px] tracking-tight text-text">
              {title}
            </span>
            {recommended && (
              <span
                className={
                  "text-[9.5px] font-semibold uppercase tracking-[0.10em] " +
                  "px-1.5 py-[2px] rounded-full " +
                  "bg-wa-green text-text-oncolor"
                }
              >
                Recommended
              </span>
            )}
          </div>
          <p className="text-[12.5px] text-text-muted leading-snug mt-1">
            {sub}
          </p>
        </div>
        <ChevronRightIcon className="text-wa-green-dark dark:text-wa-green shrink-0 transition-transform duration-200 ease-veil-soft group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

function ComingSoonOption({ title, sub }: { title: string; sub: string }) {
  return (
    <div
      aria-disabled="true"
      className={
        "w-full text-left rounded-xl bg-surface/50 border border-line/60 " +
        "px-3.5 py-2.5 flex items-center justify-between gap-3 " +
        "select-none"
      }
    >
      <div className="min-w-0">
        <div className="font-medium text-[13.5px] text-text/75 flex items-center gap-2">
          <span>{title}</span>
          <span className="text-[9.5px] uppercase tracking-[0.10em] font-semibold px-1.5 py-[2px] rounded-full bg-text/5 text-text-muted">
            Soon
          </span>
        </div>
        <div className="text-[11.5px] text-text-faint truncate">{sub}</div>
      </div>
    </div>
  );
}

/**
 * One cell of the trust strip. Icon + tiny label, stacked vertically
 * so three pills fit comfortably on a phone width.
 */
function TrustPill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <span className="text-wa-green-dark dark:text-wa-green">{icon}</span>
      <span className="text-[10.5px] font-medium text-text-muted leading-tight">
        {label}
      </span>
    </div>
  );
}

function ServerStatusBadge({ status }: { status: ServerStatus }) {
  if (status.kind === "loading") {
    return (
      <div className="flex items-center gap-2 text-[10.5px] text-text-faint">
        <span className="size-1.5 rounded-full bg-text-faint animate-pulse" />
        Connecting…
      </div>
    );
  }
  if (status.kind === "ok") {
    return (
      <div className="flex items-center gap-2 text-[10.5px] text-text-faint">
        <span className="size-1.5 rounded-full bg-wa-green" />
        Server reachable
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-[10.5px] text-red-500">
      <span className="size-1.5 rounded-full bg-red-500" />
      Server unreachable
    </div>
  );
}

/* ─────────────────────────── icons ─────────────────────────── */

function KeyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="9" cy="12" r="3.5" />
      <path d="M12.5 12h7.5" />
      <path d="M17 12v3" />
      <path d="M20 12v2" />
    </svg>
  );
}

function NoAdIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M4 4l16 16" />
    </svg>
  );
}

function NoEyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12s3.5-7 9-7c2 0 3.7.6 5.1 1.6" />
      <path d="M21 12s-3.5 7-9 7c-2 0-3.7-.6-5.1-1.6" />
      <circle cx="12" cy="12" r="3" />
      <path d="M3 3l18 18" />
    </svg>
  );
}

function DeviceIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="6" y="3" width="12" height="18" rx="2.5" />
      <path d="M11 18h2" />
    </svg>
  );
}

// Re-export for back-compat with existing imports from this module.
export { PrimaryButton };
