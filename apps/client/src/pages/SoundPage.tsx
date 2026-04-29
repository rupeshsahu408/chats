import { useNavigate } from "react-router-dom";
import { AppBar, Pill, PrimaryButton } from "../components/Layout";
import { useStealthPrefs } from "../lib/stealthPrefs";
import {
  playReceiveTone,
  playSendTone,
  playSuccessTone,
  playTapTone,
  playErrorTone,
  previewReceiveTone,
  previewSendTone,
  setSoundVolume,
} from "../lib/sound";
import {
  DEFAULT_RECEIVE_TONE_ID,
  DEFAULT_SEND_TONE_ID,
  RECEIVE_TONES,
  SEND_TONES,
  type ToneRecipe,
} from "../lib/tones";
import { feedback } from "../lib/feedback";
import { useDocumentMeta } from "../lib/useDocumentMeta";

/**
 * Sound preferences (Principle #2 — sound as identity, not alarm).
 *
 * VeilChat's audio identity is built from a few short synthesised motifs
 * — every send, receive, and confirmation has its own tonal signature
 * so the app feels alive without resorting to generic "ding" alerts.
 * This page lets the user shape that identity:
 *
 *   • master sound on/off + volume
 *   • haptics on/off
 *   • pick a favourite send tone (10 unique calm motifs)
 *   • pick a favourite receive tone (10 unique calm motifs)
 *   • test buttons that play each motif on demand
 *
 * Everything writes through the global stealth-prefs store, which
 * mirrors the change into the sound module synchronously so previews
 * immediately reflect the new state.
 */
export function SoundPage() {
  const navigate = useNavigate();
  useDocumentMeta({
    title: "Sound — VeilChat's calm audio identity",
    description:
      "Pick from 10 calm send tones and 10 receive tones, set master volume, toggle haptics. VeilChat's sound is meant to feel alive, not alarm you.",
    canonical: "/sound",
    ogType: "article",
  });
  const prefs = useStealthPrefs((s) => s.prefs);
  const setPrefs = useStealthPrefs((s) => s.set);

  const soundOn = prefs?.soundEnabled ?? true;
  const hapticsOn = prefs?.hapticsEnabled ?? true;
  const volume = prefs?.soundVolume ?? 0.6;
  const sendToneId = prefs?.sendToneId ?? DEFAULT_SEND_TONE_ID;
  const receiveToneId = prefs?.receiveToneId ?? DEFAULT_RECEIVE_TONE_ID;

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <AppBar title="Sound & feel" back={() => navigate(-1)} />
      <div className="flex-1 bg-panel pb-12 w-full mx-auto lg:max-w-2xl lg:my-4 lg:rounded-2xl lg:border lg:border-line/60 lg:shadow-card lg:overflow-hidden">
        {/* ─── Hero ─── */}
        <div className="px-5 pt-7 pb-5 text-center bg-gradient-to-b from-wa-green/8 to-transparent">
          <div className="inline-flex items-center gap-2 rounded-full bg-wa-green/12 text-wa-green-dark dark:text-wa-green px-3 py-1 text-[11px] font-semibold uppercase tracking-widest">
            <Speaker /> VeilChat sound identity
          </div>
          <h2 className="mt-3 text-[22px] font-semibold tracking-tight text-text leading-tight">
            Sound is part of how VeilChat feels
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

        {/* ─── Send tone picker ─── */}
        <SectionHeader>
          <span className="inline-flex items-center gap-1.5">
            <ArrowOut /> Send tone
          </span>
        </SectionHeader>
        <SectionIntro>
          The motif you hear when a message leaves your device. Tap any
          tone to preview it — the highlighted one becomes your default.
        </SectionIntro>
        <TonePicker
          tones={SEND_TONES}
          selected={sendToneId}
          disabled={!soundOn}
          onSelect={(id) => {
            previewSendTone(id);
            void setPrefs({ sendToneId: id });
          }}
          onPreview={(id) => previewSendTone(id)}
        />

        {/* ─── Receive tone picker ─── */}
        <SectionHeader>
          <span className="inline-flex items-center gap-1.5">
            <ArrowIn /> Receive tone
          </span>
        </SectionHeader>
        <SectionIntro>
          The motif you hear when a message arrives. Per-contact sound
          packs (set from a chat's Personality menu) still take
          priority over this default.
        </SectionIntro>
        <TonePicker
          tones={RECEIVE_TONES}
          selected={receiveToneId}
          disabled={!soundOn}
          onSelect={(id) => {
            previewReceiveTone(id);
            void setPrefs({ receiveToneId: id });
          }}
          onPreview={(id) => previewReceiveTone(id)}
        />

        {/* ─── Other VeilChat motifs (read-only previews) ─── */}
        <SectionHeader>Other VeilChat motifs</SectionHeader>
        <div className="px-4 grid grid-cols-1 gap-2">
          <MotifRow
            name="Tap"
            description="A whisper-quiet blip used on every interactive surface."
            onPlay={() => playTapTone()}
            disabled={!soundOn}
          />
          <MotifRow
            name="Send (current)"
            description="Plays your selected send tone."
            onPlay={() => playSendTone()}
            disabled={!soundOn}
          />
          <MotifRow
            name="Receive (current)"
            description="Plays your selected receive tone."
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
              VeilChat falls back to your chosen receive tone when nothing
              is set on the chat itself.
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

function SectionIntro({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 -mt-1 mb-2 text-[12.5px] text-text-muted leading-relaxed">
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

/**
 * Vertical list of selectable tones. Tapping a row both previews
 * the tone *and* makes it the user's default; the dedicated play
 * button on the right lets the user audition without changing
 * their pick.
 */
function TonePicker({
  tones,
  selected,
  disabled,
  onSelect,
  onPreview,
}: {
  tones: ToneRecipe[];
  selected: string;
  disabled?: boolean;
  onSelect: (id: string) => void;
  onPreview: (id: string) => void;
}) {
  return (
    <div className="px-3 grid grid-cols-1 gap-1.5">
      {tones.map((t) => {
        const isSelected = t.value === selected;
        return (
          <div
            key={t.value}
            className={
              "flex items-stretch gap-2 rounded-2xl border " +
              "transition-colors duration-150 " +
              (isSelected
                ? "bg-wa-green/[0.08] border-wa-green/45"
                : "bg-surface border-line/60 hover:border-line")
            }
          >
            <button
              type="button"
              onClick={() => {
                if (disabled) return;
                onSelect(t.value);
              }}
              disabled={disabled}
              aria-pressed={isSelected}
              className={
                "flex-1 min-w-0 text-left px-4 py-3 wa-tap " +
                "flex items-center gap-3 rounded-l-2xl " +
                (disabled ? "opacity-60 cursor-not-allowed" : "")
              }
            >
              <RadioDot selected={isSelected} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-text">
                    {t.label}
                  </span>
                  {isSelected && <Pill tone="ok">selected</Pill>}
                </div>
                <div className="text-[12px] text-text-muted leading-snug mt-0.5 truncate">
                  {t.description}
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                if (disabled) return;
                onPreview(t.value);
              }}
              disabled={disabled}
              aria-label={`Preview ${t.label}`}
              className={
                "shrink-0 inline-flex items-center justify-center " +
                "w-12 my-2 mr-2 rounded-xl wa-tap " +
                "transition-colors duration-150 " +
                (disabled
                  ? "bg-text/5 text-text-faint cursor-not-allowed"
                  : "bg-wa-green/12 text-wa-green-dark dark:text-wa-green " +
                    "border border-wa-green/25 hover:bg-wa-green/20")
              }
            >
              <PlayTriangle />
            </button>
          </div>
        );
      })}
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

function RadioDot({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden
      className={
        "relative shrink-0 inline-flex items-center justify-center " +
        "size-5 rounded-full border-2 transition-colors duration-150 " +
        (selected
          ? "border-wa-green bg-wa-green/15"
          : "border-line/80 bg-transparent")
      }
    >
      {selected && (
        <span className="size-2 rounded-full bg-wa-green" />
      )}
    </span>
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
function ArrowOut() {
  return (
    <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h13" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}
function ArrowIn() {
  return (
    <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H6" />
      <path d="M11 6l-6 6 6 6" />
    </svg>
  );
}
