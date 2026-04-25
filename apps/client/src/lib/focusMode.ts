/**
 * VeilChat Focus Mode (design Principle #4 — calm by default).
 *
 * One source of truth for "should VeilChat interrupt the user right now?".
 * Combines three signals:
 *   1. The master Focus toggle (`focusModeEnabled`)
 *   2. Quiet-hours window (e.g. 22:00 → 07:00, with overnight wrap)
 *   3. Manual snooze (epoch ISO timestamp)
 *
 * `isFocusActive(prefs)` returns true if ANY of those is currently
 * suppressing notifications. Helpers also compute a human-readable
 * reason and an ETA so UI surfaces (the inbox header chip, the
 * Focus Mode page, etc.) can all agree on what to show.
 *
 * Wired into `lib/feedback.ts` so the in-app receive sound + haptic
 * stay silent when focus is active. Push notifications are gated
 * separately in `lib/push.ts` for the same reason.
 */

import { useEffect, useState } from "react";
import { useStealthPrefs, getCachedStealthPrefs } from "./stealthPrefs";
import type { UserPrefRecord } from "./db";

export type FocusReason = "manual" | "snooze" | "quietHours" | null;

export interface FocusState {
  active: boolean;
  reason: FocusReason;
  /** ISO timestamp when this reason ends, or null if open-ended. */
  endsAt: string | null;
}

const DEFAULT_QUIET_START = "22:00";
const DEFAULT_QUIET_END = "07:00";

/* ───────────── pure helpers (testable, no React) ───────────── */

/** Parse "HH:MM" → minutes-since-midnight. Returns null on bad input. */
function parseHHMM(s: string | undefined): number | null {
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return h * 60 + mm;
}

/**
 * Returns true when `now` falls inside the [start, end) window. Window
 * may wrap past midnight (start > end means "from start tonight to end
 * tomorrow morning").
 */
export function isInQuietHoursNow(
  prefs: Pick<UserPrefRecord, "quietHoursEnabled" | "quietHoursStart" | "quietHoursEnd">,
  now: Date = new Date(),
): boolean {
  if (!prefs.quietHoursEnabled) return false;
  const start = parseHHMM(prefs.quietHoursStart) ?? parseHHMM(DEFAULT_QUIET_START)!;
  const end = parseHHMM(prefs.quietHoursEnd) ?? parseHHMM(DEFAULT_QUIET_END)!;
  if (start === end) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  if (start < end) return cur >= start && cur < end;
  // Overnight wrap (e.g. 22:00 → 07:00).
  return cur >= start || cur < end;
}

/**
 * Compute the next clock time at which the quiet-hours window ends,
 * given the current time. Returns an ISO string.
 */
export function nextQuietHoursEnd(
  prefs: Pick<UserPrefRecord, "quietHoursStart" | "quietHoursEnd">,
  now: Date = new Date(),
): string {
  const end = parseHHMM(prefs.quietHoursEnd) ?? parseHHMM(DEFAULT_QUIET_END)!;
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setHours(Math.floor(end / 60), end % 60);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next.toISOString();
}

/**
 * Read the live Focus state from a prefs snapshot. Pure function so
 * UI can derive the chip label / reason without subscribing.
 */
export function deriveFocusState(
  prefs: UserPrefRecord | null,
  now: Date = new Date(),
): FocusState {
  if (!prefs) return { active: false, reason: null, endsAt: null };

  // Manual snooze wins — it's the most explicit user intent.
  if (prefs.snoozeUntil) {
    const t = Date.parse(prefs.snoozeUntil);
    if (!Number.isNaN(t) && t > now.getTime()) {
      return { active: true, reason: "snooze", endsAt: prefs.snoozeUntil };
    }
  }
  if (prefs.focusModeEnabled) {
    return { active: true, reason: "manual", endsAt: null };
  }
  if (isInQuietHoursNow(prefs, now)) {
    return {
      active: true,
      reason: "quietHours",
      endsAt: nextQuietHoursEnd(prefs, now),
    };
  }
  return { active: false, reason: null, endsAt: null };
}

/**
 * Synchronous "should we suppress notification cues right now?" check.
 * Reads the cached prefs so it can be called from hot paths (incoming
 * message handler, sound bus) without React.
 */
export function isFocusActiveNow(): boolean {
  return deriveFocusState(getCachedStealthPrefs()).active;
}

/* ───────────── React hook for UI surfaces ───────────── */

/**
 * Subscribes to prefs + ticks once a minute so the chip updates
 * automatically when quiet-hours end or the snooze elapses.
 */
export function useFocusState(): FocusState {
  const prefs = useStealthPrefs((s) => s.prefs);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);
  // tick is in deps just to force a re-derive — value itself unused.
  void tick;
  return deriveFocusState(prefs);
}

/**
 * Format an ISO timestamp as "until 7:00 AM" / "for 42 minutes" etc.
 * Picks the shortest readable form; never includes seconds.
 */
export function formatFocusEnds(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "until you turn it off";
  const t = Date.parse(iso);
  if (Number.isNaN(t) || t <= now.getTime()) return "ending now";
  const mins = Math.round((t - now.getTime()) / 60_000);
  if (mins < 60) return `for ${mins} more minute${mins === 1 ? "" : "s"}`;
  const sameDay = new Date(t).toDateString() === now.toDateString();
  const time = new Date(t).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  if (sameDay) return `until ${time}`;
  return `until tomorrow ${time}`;
}

export function focusReasonLabel(reason: FocusReason): string {
  switch (reason) {
    case "manual":
      return "Focus Mode";
    case "snooze":
      return "Snoozed";
    case "quietHours":
      return "Quiet hours";
    default:
      return "";
  }
}
