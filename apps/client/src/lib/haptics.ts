/**
 * VeilChat haptics.
 *
 * Thin, lazy wrapper around `navigator.vibrate`. On platforms without
 * vibration support (most desktops, iOS Safari) every call becomes a
 * silent no-op so callers can fire-and-forget.
 *
 * Patterns are deliberately short — these are conversational micro-cues
 * to match the matching sound motifs, not buzz-attention alarms.
 */

let hapticsEnabled = true;

export function setHapticsEnabled(v: boolean): void {
  hapticsEnabled = v;
}

function canVibrate(): boolean {
  if (!hapticsEnabled) return false;
  if (typeof navigator === "undefined") return false;
  return typeof navigator.vibrate === "function";
}

function buzz(pattern: number | number[]): void {
  if (!canVibrate()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* Some browsers throw on rapid repeat — safe to ignore. */
  }
}

/** ~8 ms — softest possible "I felt the tap." */
export function hapticTap(): void {
  buzz(8);
}

/** ~15 ms — slightly more present, for confirmations. */
export function hapticSoft(): void {
  buzz(15);
}

/** A short "ba-dum" for sends and successful actions. */
export function hapticSuccess(): void {
  buzz([10, 40, 12]);
}

/** Two quick taps for incoming activity. */
export function hapticReceive(): void {
  buzz([12, 60, 12]);
}

/** A heavier triple for errors. */
export function hapticError(): void {
  buzz([40, 30, 40, 30, 40]);
}

/** Cancel any in-flight vibration. */
export function hapticCancel(): void {
  if (!canVibrate()) return;
  try {
    navigator.vibrate(0);
  } catch {
    /* ignore */
  }
}
