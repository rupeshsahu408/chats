import { useNavigate } from "react-router-dom";
import { AppBar, Pill, PrimaryButton } from "../components/Layout";
import { useStealthPrefs } from "../lib/stealthPrefs";
import {
  playReceiveTone,
  playSendTone,
  playSuccessTone,
  playTapTone,
  playErrorTone,
  setSoundVolume,
} from "../lib/sound";
import { feedback } from "../lib/feedback";

/**
 * Sound preferences (Principle #2 — sound as identity, not alarm).
 *
 * Veil's audio identity is built from a few short synthesised motifs
 * — every send, receive, and confirmation has its own tonal signature
 * so the app feels alive without resorting to generic "ding" alerts.
 * This page lets the user shape that identity:
 *
 *   • master sound on/off + volume
 *   • haptics on/off
 *   • test buttons that play each motif on demand
 *
 * Everything writes through the global stealth-prefs store, which
 * mirrors the change into the sound module synchronously so the test
 * buttons immediately reflect the new state.
 */
export function SoundPage() {
  const navigate = useNavigate();
  const prefs = useStealthPrefs((s) => s.prefs);
  const setPrefs = useStealthPrefs((s) => s.set);

  const soundOn = prefs?.soundEnabled ?? true;
  const hapticsOn = prefs?.hapticsEnabled ?? true;
  const volume = prefs?.soundVolume ?? 0.6;

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <AppBar title="Sound & feel" back={() => navigate(-1)} />
      <div className="flex-1 bg-panel pb-12">
        {/* ─── Hero ─── */}
        <div className="px-5 pt-7 pb-5 text-center bg-gradient-to-b from-wa-green/8 to-transparent">
          <div className="inline-flex items-center gap-2 rounded-full bg-wa-green/12 text-wa-green-dark dark:text-wa-green px-3 py-1 text-[11px] font-semibold uppercase tracking-widest">
            <Speaker /> Veil sound identity
          </div>
          <h2 className="mt-3 text-[22px] font-semibold tracking-tight text-text leading-tight">
            Sound is part of how Veil feels
          </h2>
          <p className="mt-2 text-[13px] text-text-muted leading-relaxed max-w-md mx-auto">
            Each motif is a few notes long and synthesised on the fly.
            We never ship audio files — your sound bus weighs nothing.
          </p>
        </div>

        {/* ─── Master toggles ─── */}
        <SectionHeader>Master controls</SectionHeader>
        <ToggleCard
          title="Sound"
          sub={soundOn ? "Tap, send, and arrival motifs play." : "All motifs silenced."}
          checked={soundOn}
          onChange={async (v) => {
            await setPrefs({ soundEnabled: v });
            if (v) feedback.success();
          }}
        />
        <ToggleCard
          title="Haptics"
          sub={
            hapticsOn
              ? "Soft vibrations match the sound motifs (mobile only)."
              : "Vibrations are off."
          }
          checked={hapticsOn}
          onChange={async (v) => {
            await setPrefs({ hapticsEnabled: v });
            if (v) feedback.tap();
          }}
        />

        {/* ─── Volume ─── */}
        <SectionHeader>Volume</SectionHeader>
        <div className="px-4">
          <div className="rounded-2xl bg-surface border border-line/60 px-4 py-4">
            <div className="flex items-center gap-3">
              <SpeakerSmall />
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setSoundVolume(v); // immediate audible change
                  void setPrefs({ soundVolume: v });
                }}
                onMouseUp={() => playTapTone()}
                onTouchEnd={() => playTapTone()}
                className="flex-1 accent-wa-green"
                disabled={!soundOn}
              />
              <span className="text-[12.5px] tabular-nums text-text-muted w-9 text-right">
                {Math.round(volume * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* ─── Test motifs ─── */}
        <SectionHeader>Listen to the motifs</SectionHeader>
        <div className="px-4 grid grid-cols-1 gap-2">
          <MotifRow
            name="Tap"
            description="A whisper-quiet blip used on every interactive surface."
            onPlay={() => playTapTone()}
            disabled={!soundOn}
          />
          <MotifRow
            name="Send"
            description="A confident rising arpeggio when your message leaves the device."
            onPlay={() => playSendTone()}
            disabled={!soundOn}
          />
          <MotifRow
            name="Receive"
            description="A descending three-note motif — gentle, never demanding."
            onPlay={() => playReceiveTone()}
            disabled={!soundOn}
          />
          <MotifRow
            name="Success"
            description="A soft two-note up-chime for pinned, copied, or saved actions."
            onPlay={() => playSuccessTone()}
            disabled={!soundOn}
          />
          <MotifRow
            name="Error"
            description="A brief downward glide so a failure registers without alarm."
            onPlay={() => playErrorTone()}
            disabled={!soundOn}
            tone="warn"
          />
        </div>

        {/* ─── Per-contact packs ─── */}
        <div className="px-4 mt-6">
          <div className="rounded-2xl bg-wa-green/[0.06] border border-wa-green/25 px-4 py-4">
            <div className="text-[13px] font-semibold text-text">
              Each contact can have its own arrival sound.
            </div>
            <p className="text-[12.5px] text-text-muted leading-relaxed mt-1">
              Long-press a chat → Personality to pick a sound pack —
              warm chime, minimal tick, doorbell, silent, and more.
              Veil falls back to the default motif when nothing is set.
            </p>
          </div>
        </div>

        <div className="px-4 pt-6">
          <PrimaryButton onClick={() => navigate("/chats")}>Back to chats</PrimaryButton>
        </div>
      </div>
    </div>
  );
}

/* ─────────── building blocks ─────────── */

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 pt-6 pb-2 text-[11px] uppercase tracking-widest text-text-muted">
      {children}
    </div>
  );
}

function ToggleCard({
  title,
  sub,
  checked,
  onChange,
}: {
  title: string;
  sub: string;
  checked: boolean;
  onChange: (v: boolean) => void | Promise<void>;
}) {
  return (
    <div className="px-3">
      <button
        type="button"
        onClick={() => void onChange(!checked)}
        className={
          "w-full text-left px-4 py-3.5 flex items-center gap-3 " +
          "bg-surface border border-line/60 rounded-2xl wa-tap " +
          "transition-colors duration-150 " +
          (checked ? "border-wa-green/40 bg-wa-green/[0.06]" : "")
        }
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold text-text">{title}</span>
            {checked && <Pill tone="ok">on</Pill>}
          </div>
          <div className="text-[12.5px] text-text-muted leading-snug mt-0.5">{sub}</div>
        </div>
        <span
          aria-hidden
          className={
            "relative inline-flex h-6 w-10 rounded-full shrink-0 " +
            "transition-colors duration-200 " +
            (checked ? "bg-wa-green" : "bg-line/80")
          }
        >
          <span
            className={
              "absolute top-0.5 left-0.5 size-5 rounded-full bg-white " +
              "[box-shadow:0_1px_2px_rgba(0,0,0,0.18)] " +
              "transition-transform duration-200 ease-veil-spring " +
              (checked ? "translate-x-4" : "translate-x-0")
            }
          />
        </span>
      </button>
    </div>
  );
}

function MotifRow({
  name,
  description,
  onPlay,
  disabled,
  tone = "accent",
}: {
  name: string;
  description: string;
  onPlay: () => void;
  disabled?: boolean;
  tone?: "accent" | "warn";
}) {
  return (
    <div
      className={
        "flex items-center gap-3 px-4 py-3 rounded-2xl " +
        "bg-surface border border-line/60"
      }
    >
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-semibold text-text">{name}</div>
        <div className="text-[12px] text-text-muted leading-snug mt-0.5">
          {description}
        </div>
      </div>
      <button
        onClick={() => {
          if (disabled) return;
          onPlay();
        }}
        disabled={disabled}
        aria-label={`Play ${name} motif`}
        className={
          "shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-full " +
          "text-[12.5px] font-semibold wa-tap " +
          "transition-colors duration-150 " +
          (disabled
            ? "bg-text/5 text-text-faint cursor-not-allowed"
            : tone === "warn"
              ? "bg-amber-500/12 text-amber-700 dark:text-amber-300 border border-amber-500/25 hover:bg-amber-500/18"
              : "bg-wa-green/12 text-wa-green-dark dark:text-wa-green border border-wa-green/25 hover:bg-wa-green/18")
        }
      >
        <PlayTriangle /> Play
      </button>
    </div>
  );
}

function Speaker() {
  return (
    <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 9h3l4-3v12l-4-3H5z" />
      <path d="M16 8c1.5 1.5 1.5 6.5 0 8" />
    </svg>
  );
}
function SpeakerSmall() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
      <path d="M5 9h3l4-3v12l-4-3H5z" />
      <path d="M16 8c1.5 1.5 1.5 6.5 0 8" />
    </svg>
  );
}
function PlayTriangle() {
  return (
    <svg viewBox="0 0 24 24" width={11} height={11} fill="currentColor">
      <path d="M7 5l12 7-12 7V5z" />
    </svg>
  );
}
