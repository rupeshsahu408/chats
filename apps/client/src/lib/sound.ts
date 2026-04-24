/**
 * Veil sound identity.
 *
 * Distinctive synthesised motifs for send / receive, plus a tiny tap
 * blip and short success / error tones. Everything is generated at
 * runtime with the Web Audio API so we ship zero audio assets and
 * stay snappy on slow links.
 *
 * The catalogs of selectable send / receive tones live in
 * `lib/tones.ts` so the UI can render labels + previews without
 * pulling in the audio engine. This module owns the AudioContext,
 * volume, and the actual scheduling.
 *
 * Volumes are intentionally low — these are micro-cues, not effects.
 */

import { getSoundPack } from "./chatPersonality";
import {
  DEFAULT_RECEIVE_TONE_ID,
  DEFAULT_SEND_TONE_ID,
  getReceiveTone,
  getSendTone,
  type ToneRecipe,
} from "./tones";

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let unlocked = false;
let soundEnabled = true;
let outputVolume = 0.6;

/** Cached user picks — kept in sync by `stealthPrefs.syncFeedbackModules`. */
let sendToneId: string = DEFAULT_SEND_TONE_ID;
let receiveToneId: string = DEFAULT_RECEIVE_TONE_ID;

type ToneOpts = {
  /** Hz */
  freq: number;
  /** Seconds offset from "now" when the note should start. */
  startAt?: number;
  /** Seconds the note should last. */
  duration: number;
  /** Peak amplitude before master gain (0..1). */
  gain?: number;
  /** Oscillator type. Sine = soft & vocal, triangle = a touch brighter. */
  type?: OscillatorType;
  /** Optional pitch glide to this Hz over the note's duration. */
  glideTo?: number;
};

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
    masterGain = ctx.createGain();
    masterGain.gain.value = outputVolume;
    masterGain.connect(ctx.destination);
  } catch {
    ctx = null;
    masterGain = null;
  }
  return ctx;
}

/**
 * Browsers require a user gesture before audio will play. Wire this to
 * the first pointer/key event so the AudioContext is "running" by the
 * time we want to play a tone.
 */
export function unlockAudioOnFirstGesture(): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => {
    const c = getCtx();
    if (c && c.state === "suspended") {
      void c.resume().catch(() => undefined);
    }
    unlocked = true;
    window.removeEventListener("pointerdown", handler, true);
    window.removeEventListener("keydown", handler, true);
    window.removeEventListener("touchstart", handler, true);
  };
  window.addEventListener("pointerdown", handler, true);
  window.addEventListener("keydown", handler, true);
  window.addEventListener("touchstart", handler, true);
  return () => {
    window.removeEventListener("pointerdown", handler, true);
    window.removeEventListener("keydown", handler, true);
    window.removeEventListener("touchstart", handler, true);
  };
}

export function setSoundEnabled(v: boolean): void {
  soundEnabled = v;
}

export function setSoundVolume(v: number): void {
  outputVolume = Math.max(0, Math.min(1, v));
  if (masterGain) masterGain.gain.value = outputVolume;
}

/** Update which send tone the synthesizer should play. */
export function setSendToneId(id: string | null | undefined): void {
  sendToneId = id || DEFAULT_SEND_TONE_ID;
}

/** Update which receive tone the synthesizer should play. */
export function setReceiveToneId(id: string | null | undefined): void {
  receiveToneId = id || DEFAULT_RECEIVE_TONE_ID;
}

/** Schedule a single envelope-shaped tone. */
function tone(opts: ToneOpts): void {
  const c = getCtx();
  if (!c || !masterGain) return;
  const now = c.currentTime + (opts.startAt ?? 0);
  const dur = opts.duration;
  const peak = (opts.gain ?? 0.18);

  const osc = c.createOscillator();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(opts.freq, now);
  if (opts.glideTo) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(20, opts.glideTo),
      now + dur,
    );
  }

  const g = c.createGain();
  // ADSR-ish: 6ms attack, soft decay to ~70%, exponential release.
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(peak, now + 0.006);
  g.gain.exponentialRampToValueAtTime(peak * 0.7, now + dur * 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  osc.connect(g).connect(masterGain);
  osc.start(now);
  osc.stop(now + dur + 0.02);
}

/** Play every note in a `ToneRecipe` from `tones.ts`. */
function playRecipe(recipe: ToneRecipe): void {
  for (const n of recipe.notes) {
    tone({
      freq: n.freq,
      duration: n.duration,
      gain: n.gain ?? 0.13,
      type: n.type ?? "sine",
      startAt: n.startAt ?? 0,
      glideTo: n.glideTo,
    });
  }
}

function shouldPlay(): boolean {
  if (!soundEnabled) return false;
  const c = getCtx();
  if (!c) return false;
  // Try to resume even if not "unlocked" — many browsers permit this.
  if (c.state === "suspended") {
    void c.resume().catch(() => undefined);
  }
  return c.state === "running" || unlocked;
}

/**
 * Outgoing message: plays the tone the user picked from the
 * SEND_TONES catalog (defaults to "Aurora" — the original Veil
 * rising arpeggio). Total ≈80–280ms depending on pick.
 */
export function playSendTone(): void {
  if (!shouldPlay()) return;
  playRecipe(getSendTone(sendToneId));
}

/**
 * Incoming message:
 *   • If `packKey` is provided AND it matches a per-contact pack
 *     (chatPersonality.SOUND_PACKS), play that contact's pack
 *     so each peer can have their own arrival cue.
 *   • Otherwise, play the user's chosen receive tone from the
 *     RECEIVE_TONES catalog (defaults to "Drift").
 *   • Silent packs and silent tones short-circuit cleanly so
 *     haptics-only setups still feel right.
 */
export function playReceiveTone(packKey?: string): void {
  if (!shouldPlay()) return;
  // Per-contact override path (legacy SOUND_PACKS).
  if (packKey && packKey !== "default") {
    const pack = getSoundPack(packKey);
    // Only treat it as an override if it's actually a known pack.
    if (pack.value === packKey) {
      if (pack.value === "silent" || pack.duration <= 0) return;
      const longTail = pack.duration * 2;
      tone({
        freq: pack.notes[0],
        duration: pack.duration,
        gain: pack.gain,
        startAt: 0.0,
        type: pack.oscillator,
      });
      if (pack.notes[1] > 0) {
        tone({
          freq: pack.notes[1],
          duration: pack.duration,
          gain: pack.gain,
          startAt: pack.duration * 0.85,
          type: pack.oscillator,
        });
      }
      if (pack.notes[2] > 0) {
        tone({
          freq: pack.notes[2],
          duration: longTail,
          gain: pack.gain * 1.1,
          startAt: pack.duration * 1.7,
          type: pack.oscillator,
        });
      }
      return;
    }
  }
  // Default path — user's chosen receive tone.
  playRecipe(getReceiveTone(receiveToneId));
}

/**
 * Preview a specific send tone by id without changing the user's pick.
 * Used by the picker rows in the Sound settings page.
 */
export function previewSendTone(id: string): void {
  if (!shouldPlay()) return;
  playRecipe(getSendTone(id));
}

/**
 * Preview a specific receive tone by id without changing the user's pick.
 */
export function previewReceiveTone(id: string): void {
  if (!shouldPlay()) return;
  playRecipe(getReceiveTone(id));
}

/** Tiny one-shot blip for taps. Very quiet. */
export function playTapTone(): void {
  if (!shouldPlay()) return;
  tone({ freq: 880, duration: 0.045, gain: 0.06, type: "triangle" });
}

/** A short downward "uh-oh" for errors. */
export function playErrorTone(): void {
  if (!shouldPlay()) return;
  tone({ freq: 392, duration: 0.18, gain: 0.16, type: "triangle", glideTo: 220 });
}

/** A soft single high note for success acks (e.g. mute, pin). */
export function playSuccessTone(): void {
  if (!shouldPlay()) return;
  tone({ freq: 880, duration: 0.06, gain: 0.12 });
  tone({ freq: 1318.5, duration: 0.10, gain: 0.14, startAt: 0.05 });
}
