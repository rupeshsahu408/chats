import { useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { AppBar, PrimaryButton } from "../components/Layout";

/**
 * "Our promises" — the manifesto page (Principles #7 + #8).
 *
 * VeilChat's stance, stated plainly. Four cards, each one short enough
 * to read in a breath. The page exists so we can link to it from
 * the welcome screen, settings, and any external surface (the
 * landing page, an invite, a press kit) without re-writing the
 * same copy in three places.
 *
 * Tone rules:
 *   • declarative, never preachy
 *   • numbers and concretes over adjectives
 *   • one sentence sets the rule, one sentence shows how we keep it
 */
export function PromisesPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <AppBar title="Our promises" back={() => navigate(-1)} />

      <div className="flex-1 bg-panel pb-14 w-full mx-auto lg:max-w-2xl lg:my-4 lg:rounded-2xl lg:border lg:border-line/60 lg:shadow-card lg:overflow-hidden">
        {/* ─── Hero ─── */}
        <div className="px-5 pt-9 pb-6 text-center bg-gradient-to-b from-wa-green/8 to-transparent">
          <div className="inline-flex items-center gap-2 rounded-full bg-wa-green/12 text-wa-green-dark dark:text-wa-green px-3 py-1 text-[11px] font-semibold uppercase tracking-widest">
            <DotPulse /> What we owe you
          </div>
          <h2 className="mt-4 text-[26px] font-semibold tracking-tight text-text leading-[1.15] max-w-md mx-auto">
            A messenger should be on{" "}
            <span className="text-wa-green-dark dark:text-wa-green">your side</span>.
          </h2>
          <p className="mt-3 text-[13.5px] text-text-muted leading-relaxed max-w-md mx-auto">
            These four promises shape every decision we make. If we
            ever break one, you can hold us to it.
          </p>
        </div>

        {/* ─── Promise cards ─── */}
        <div className="px-4 mt-2 space-y-3">
          <PromiseCard
            number="01"
            headline="No ads. Ever."
            body="VeilChat will never show you a banner, sponsored chat, promoted contact, or any other paid surface. There is no advertising stack inside this app."
            proof="Open the source — there's no ad SDK, no tracking pixel, no analytics ID."
            icon={<NoAdIcon />}
            accent
          />
          <PromiseCard
            number="02"
            headline="We don't sell or share your data."
            body="We don't sell your information, share it with brokers, or rent it to third-party services. Your contacts are yours."
            proof="Our server only stores what's needed to deliver a message. The 'What we store' page lists every field."
            icon={<NoShareIcon />}
          />
          <PromiseCard
            number="03"
            headline="Your messages live on your device."
            body="VeilChat is local-first. Your chat history, identity keys, and conversation state all live on this device — never on our servers in readable form."
            proof="Our server only sees encrypted blobs it can't open. Lose your phone? We can't recover your chats either."
            icon={<DeviceIcon />}
          />
          <PromiseCard
            number="04"
            headline="Built to be verified."
            body="VeilChat is built on the same battle‑tested cryptographic standards (Signal Protocol, Double Ratchet, X3DH) that secure billions of conversations every day. No homemade crypto. No proprietary tricks. Just well‑understood math you don't have to take our word for."
            proof="Our promises mean nothing if you can't verify them. The cryptography is the receipt."
            icon={<CodeIcon />}
          />
        </div>

        {/* ─── Closing line ─── */}
        <div className="mt-9 px-6 text-center">
          <p className="text-[13px] text-text-muted leading-relaxed max-w-sm mx-auto">
            We don't make money from you being on VeilChat.{" "}
            <span className="text-text">
              We make VeilChat because we believe private conversation is a
              human default, not a luxury feature.
            </span>
          </p>
        </div>

        <div className="mt-7 px-4 flex flex-wrap gap-2 justify-center">
          <PrimaryButton onClick={() => navigate("/under-the-hood")}>
            See what's running on this device
          </PrimaryButton>
          <button
            type="button"
            onClick={() => navigate("/what-we-store")}
            className="px-4 py-2.5 rounded-xl bg-surface border border-line text-text text-[13px] font-semibold hover:bg-elevated/60 wa-tap"
          >
            What we store
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────── building blocks ─────────── */

function PromiseCard({
  number,
  headline,
  body,
  proof,
  icon,
  accent,
}: {
  number: string;
  headline: string;
  body: string;
  proof: string;
  icon: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={
        "rounded-2xl border px-5 py-5 " +
        (accent
          ? "bg-gradient-to-b from-wa-green/[0.10] to-wa-green/[0.04] border-wa-green/30"
          : "bg-surface border-line/60")
      }
    >
      <div className="flex items-start gap-4">
        <div
          className={
            "size-12 rounded-2xl shrink-0 grid place-items-center " +
            "bg-gradient-to-b from-wa-green to-wa-green-dark text-text-oncolor " +
            "[box-shadow:inset_0_1px_0_rgba(255,255,255,0.18),0_2px_6px_rgba(0,168,132,0.28)]"
          }
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-wa-green-dark dark:text-wa-green tabular-nums">
              {number}
            </span>
          </div>
          <h3 className="text-[18px] font-semibold tracking-tight text-text leading-tight mt-1">
            {headline}
          </h3>
          <p className="text-[13.5px] text-text leading-relaxed mt-2">
            {body}
          </p>
          <div className="mt-3 flex items-start gap-2 text-[12px] text-text-muted leading-relaxed">
            <CheckIcon />
            <span>{proof}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DotPulse() {
  return (
    <span className="relative inline-flex">
      <span className="absolute inset-0 rounded-full bg-wa-green/40 animate-ping" />
      <span className="relative size-1.5 rounded-full bg-wa-green" />
    </span>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className="text-wa-green-dark dark:text-wa-green mt-0.5 shrink-0">
      <polyline points="5 12 10 17 19 7" />
    </svg>
  );
}

function NoAdIcon() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M4 4l16 16" />
    </svg>
  );
}

function NoShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M8.5 11l7.5-3.5" />
      <path d="M8.5 13l7.5 3.5" />
      <path d="M3 3l18 18" />
    </svg>
  );
}

function DeviceIcon() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="3" width="12" height="18" rx="2.5" />
      <path d="M11 18h2" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 8 4 12 9 16" />
      <polyline points="15 8 20 12 15 16" />
    </svg>
  );
}
