import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppBar, Pill, PrimaryButton, SecondaryButton } from "../components/Layout";
import { useStealthPrefs } from "../lib/stealthPrefs";
import {
  deriveFocusState,
  formatFocusEnds,
  focusReasonLabel,
} from "../lib/focusMode";
import { feedback } from "../lib/feedback";

/**
 * Focus Mode (Principle #4 — calm by default).
 *
 * The single screen that lets the user tell VeilChat "don't interrupt me".
 * Three independent levers, evaluated in this order of explicitness:
 *
 *   1. Snooze for N hours        (most explicit — overrides everything)
 *   2. Master Focus Mode toggle  (open-ended)
 *   3. Quiet hours window        (recurring, time-of-day aware)
 *
 * Whichever is currently active is reflected in the live status pill at
 * the top so the user always knows whether VeilChat is going to keep quiet,
 * and until when. Everything writes through `useStealthPrefs.set` so
 * the change is persisted to Dexie + propagated to the sound bus
 * immediately.
 */
export function FocusModePage() {
  const navigate = useNavigate();
  const prefs = useStealthPrefs((s) => s.prefs);
  const setPrefs = useStealthPrefs((s) => s.set);

  // Re-derive the focus state once a minute so the "until 7:00 AM"
  // string stays accurate as time passes.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);
  void tick;

  const state = useMemo(
    () => deriveFocusState(prefs ?? null),
    [prefs, tick],
  );

  const focusOn = !!prefs?.focusModeEnabled;
  const quietOn = !!prefs?.quietHoursEnabled;
  const quietStart = prefs?.quietHoursStart ?? "22:00";
  const quietEnd = prefs?.quietHoursEnd ?? "07:00";
  const snoozedUntil = prefs?.snoozeUntil
    ? Date.parse(prefs.snoozeUntil)
    : 0;
  const isSnoozed = snoozedUntil > Date.now();

  async function snoozeFor(hours: number) {
    feedback.success();
    const target = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    await setPrefs({ snoozeUntil: target });
  }
  async function snoozeUntilTomorrowMorning() {
    feedback.success();
    const t = new Date();
    t.setHours(8, 0, 0, 0);
    if (t.getTime() <= Date.now()) t.setDate(t.getDate() + 1);
    await setPrefs({ snoozeUntil: t.toISOString() });
  }
  async function clearSnooze() {
    feedback.tap();
    await setPrefs({ snoozeUntil: "" });
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <AppBar title="Focus Mode" back={() => navigate(-1)} />
      <div className="flex-1 bg-panel pb-12 w-full mx-auto lg:max-w-2xl lg:my-4 lg:rounded-2xl lg:border lg:border-line/60 lg:shadow-card lg:overflow-hidden">
        {/* ─── Hero / live status ─── */}
        <div className="px-5 pt-7 pb-5 text-center bg-gradient-to-b from-wa-green/8 to-transparent">
          <div className="inline-flex items-center gap-2 rounded-full bg-wa-green/12 text-wa-green-dark dark:text-wa-green px-3 py-1 text-[11px] font-semibold uppercase tracking-widest">
            {state.active ? (
              <>
                <BreatheDot /> Quiet right now
              </>
            ) : (
              <>
                <span className="size-1.5 rounded-full bg-text-faint" />
                Notifications on
              </>
            )}
          </div>
          <h2 className="mt-3 text-[22px] font-semibold tracking-tight text-text leading-tight">
            {state.active
              ? "VeilChat won't interrupt you"
              : "Decide when you want to be reachable"}
          </h2>
          {state.active && (
            <p className="mt-2 text-[13px] text-text-muted leading-relaxed max-w-md mx-auto">
              {focusReasonLabel(state.reason)} ·{" "}
              {formatFocusEnds(state.endsAt)}.<br />
              Messages still arrive in your inbox — we just won't make
              a sound.
            </p>
          )}
          {!state.active && (
            <p className="mt-2 text-[13px] text-text-muted leading-relaxed max-w-md mx-auto">
              Snooze for a moment, set quiet hours, or turn on Focus
              Mode for as long as you need.
            </p>
          )}
        </div>

        {/* ─── Snooze ─── */}
        <SectionHeader>Snooze for a while</SectionHeader>
        <div className="px-4 pb-3">
          <div className="grid grid-cols-2 gap-2">
            <SnoozeChip
              label="30 minutes"
              active={isSnoozed && snoozedUntil - Date.now() < 35 * 60_000}
              onClick={() => snoozeFor(0.5)}
            />
            <SnoozeChip label="1 hour" onClick={() => snoozeFor(1)} />
            <SnoozeChip label="4 hours" onClick={() => snoozeFor(4)} />
            <SnoozeChip
              label="Until morning"
              onClick={snoozeUntilTomorrowMorning}
            />
          </div>
          {isSnoozed && (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-wa-green/10 border border-wa-green/25 px-4 py-3">
              <div className="text-[13px] text-text">
                Snoozed{" "}
                <span className="text-wa-green-dark dark:text-wa-green font-semibold">
                  {formatFocusEnds(prefs?.snoozeUntil ?? null)}
                </span>
              </div>
              <button
                onClick={clearSnooze}
                className="text-[12.5px] font-semibold text-text-muted hover:text-text wa-tap"
              >
                End snooze
              </button>
            </div>
          )}
        </div>

        {/* ─── Master Focus Mode ─── */}
        <SectionHeader>Focus Mode</SectionHeader>
        <ToggleCard
          title="Focus Mode"
          sub="Stay quiet until you turn it off again."
          checked={focusOn}
          onChange={async (v) => {
            feedback.tap();
            await setPrefs({ focusModeEnabled: v });
          }}
        />

        {/* ─── Quiet hours ─── */}
        <SectionHeader>Quiet hours</SectionHeader>
        <ToggleCard
          title="Repeat every day"
          sub={
            quietOn
              ? `From ${formatHHMM(quietStart)} to ${formatHHMM(quietEnd)} · automatic`
              : "Pick a window and VeilChat will go silent every day."
          }
          checked={quietOn}
          onChange={async (v) => {
            feedback.tap();
            await setPrefs({
              quietHoursEnabled: v,
              quietHoursStart: prefs?.quietHoursStart ?? "22:00",
              quietHoursEnd: prefs?.quietHoursEnd ?? "07:00",
            });
          }}
        />
        {quietOn && (
          <div className="px-4 pb-1 grid grid-cols-2 gap-3 mt-1">
            <TimeField
              label="Starts"
              value={quietStart}
              onChange={(v) => void setPrefs({ quietHoursStart: v })}
            />
            <TimeField
              label="Ends"
              value={quietEnd}
              onChange={(v) => void setPrefs({ quietHoursEnd: v })}
            />
          </div>
        )}

        {/* ─── What this changes ─── */}
        <SectionHeader>While VeilChat is quiet</SectionHeader>
        <div className="px-4">
          <ul className="rounded-2xl bg-surface border border-line/60 divide-y divide-line/40 text-[13px]">
            <FactRow ok>Messages still arrive in your inbox.</FactRow>
            <FactRow ok>Your contacts can still see you online.</FactRow>
            <FactRow no>No notification sounds.</FactRow>
            <FactRow no>No vibration.</FactRow>
            <FactRow no>No system push notifications (best effort).</FactRow>
          </ul>
          <p className="mt-3 text-[12px] text-text-faint leading-relaxed">
            Focus state lives only on this device. We don't send a
            "do not disturb" signal to other people — to them, you
            simply look quiet.
          </p>
        </div>

        <div className="px-4 pt-6 flex gap-2">
          <PrimaryButton onClick={() => navigate("/chats")}>Back to chats</PrimaryButton>
          {state.active && (
            <SecondaryButton
              onClick={async () => {
                feedback.success();
                await setPrefs({
                  focusModeEnabled: false,
                  snoozeUntil: "",
                  quietHoursEnabled: false,
                });
              }}
            >
              Turn everything off
            </SecondaryButton>
          )}
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

function SnoozeChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "h-11 rounded-2xl border text-[13.5px] font-semibold wa-tap " +
        "transition-colors duration-150 " +
        (active
          ? "border-wa-green/50 bg-wa-green/12 text-wa-green-dark dark:text-wa-green"
          : "border-line/60 bg-surface text-text hover:border-wa-green/40")
      }
    >
      {label}
    </button>
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
    <button
      type="button"
      onClick={() => void onChange(!checked)}
      className={
        "w-full text-left px-4 py-3.5 flex items-center gap-3 " +
        "bg-surface border border-line/60 rounded-2xl mx-3 wa-tap " +
        "transition-colors duration-150 " +
        (checked ? "border-wa-green/40 bg-wa-green/[0.06]" : "")
      }
      style={{ width: "calc(100% - 1.5rem)" }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-semibold text-text">{title}</span>
          {checked && <Pill tone="ok">on</Pill>}
        </div>
        <div className="text-[12.5px] text-text-muted leading-snug mt-0.5">
          {sub}
        </div>
      </div>
      <SwitchVisual checked={checked} />
    </button>
  );
}

function SwitchVisual({ checked }: { checked: boolean }) {
  return (
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
  );
}

function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-widest text-text-muted mb-1">
        {label}
      </div>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={
          "w-full bg-surface border border-line rounded-xl px-3 py-2.5 " +
          "text-text text-[15px] tabular-nums outline-none " +
          "focus:border-wa-green transition-colors"
        }
      />
    </label>
  );
}

function FactRow({
  children,
  ok,
  no,
}: {
  children: React.ReactNode;
  ok?: boolean;
  no?: boolean;
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      {ok && (
        <span className="size-5 rounded-full bg-wa-green/15 text-wa-green-dark dark:text-wa-green grid place-items-center shrink-0">
          <CheckIcon />
        </span>
      )}
      {no && (
        <span className="size-5 rounded-full bg-text/8 text-text-muted grid place-items-center shrink-0">
          <DashIcon />
        </span>
      )}
      <span className="text-text">{children}</span>
    </li>
  );
}

function BreatheDot() {
  return (
    <span className="relative inline-flex">
      <span className="absolute inset-0 rounded-full bg-wa-green/40 animate-ping" />
      <span className="relative size-1.5 rounded-full bg-wa-green" />
    </span>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="5 12 10 17 19 7" />
    </svg>
  );
}

function DashIcon() {
  return (
    <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
      <line x1="6" y1="12" x2="18" y2="12" />
    </svg>
  );
}

/** Format "HH:MM" 24-hour as e.g. "10:00 PM" using the current locale. */
function formatHHMM(s: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return s;
  const d = new Date();
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
