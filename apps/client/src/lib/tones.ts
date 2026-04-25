/**
 * VeilChat tone library.
 *
 * Two curated catalogs of synthesised motifs — ten for the moment a
 * message *leaves* your device (`SEND_TONES`) and ten for the moment a
 * message *arrives* (`RECEIVE_TONES`). Each tone is just a small list
 * of notes (freq + duration + optional pitch glide + simultaneous
 * stacking) so the entire library ships as a few KB of data and is
 * synthesised on demand by `lib/sound.ts`. Every tone is intentionally
 * calm, short, and tonally distinct — no buzzers, no alarms.
 *
 * Design notes:
 *   • All frequencies are drawn from the C-major / pentatonic family
 *     so that even when several tones play near each other (rapid
 *     send/receive ping-pong) the soundscape stays harmonious.
 *   • Send tones lean *up* in pitch — confident, departing.
 *   • Receive tones lean *down* or *settle* — grounded, arriving.
 *   • Gains are kept very low (≤0.16 peak) so the tones feel like
 *     micro-cues, never alerts.
 */

export type ToneNote = {
  freq: number;
  duration: number;
  /** Peak amplitude before master gain (0..1). Defaults to ~0.13. */
  gain?: number;
  /** "sine" = soft & vocal; "triangle" = a touch brighter. */
  type?: OscillatorType;
  /** Seconds offset from the start of the tone. Defaults to 0. */
  startAt?: number;
  /** Optional pitch glide to this Hz over the note's duration. */
  glideTo?: number;
};

export type ToneRecipe = {
  /** Stable key persisted in user prefs. */
  value: string;
  label: string;
  description: string;
  notes: ToneNote[];
};

/* ──────────────────── send tones (10) ──────────────────── */

export const DEFAULT_SEND_TONE_ID = "aurora";

export const SEND_TONES: ToneRecipe[] = [
  {
    value: "aurora",
    label: "Aurora",
    description: "A confident rising arpeggio — VeilChat's signature send.",
    notes: [
      { freq: 659.25, duration: 0.07, gain: 0.16, startAt: 0.0 },
      { freq: 783.99, duration: 0.07, gain: 0.16, startAt: 0.06 },
      { freq: 1046.5, duration: 0.12, gain: 0.18, startAt: 0.12 },
    ],
  },
  {
    value: "whisper",
    label: "Whisper",
    description: "A breathy glide upward — barely there.",
    notes: [
      { freq: 587.33, duration: 0.24, gain: 0.10, glideTo: 880 },
    ],
  },
  {
    value: "pebble",
    label: "Pebble",
    description: "Two crisp ticks — a stone skipping water.",
    notes: [
      { freq: 1046.5, duration: 0.05, gain: 0.12, type: "triangle" },
      { freq: 1318.5, duration: 0.06, gain: 0.12, type: "triangle", startAt: 0.05 },
    ],
  },
  {
    value: "lift",
    label: "Lift",
    description: "A smooth octave climb that lets your message take off.",
    notes: [
      { freq: 523.25, duration: 0.22, gain: 0.16, glideTo: 1046.5 },
    ],
  },
  {
    value: "brass",
    label: "Brass",
    description: "A warm soft chord then a top note — calm authority.",
    notes: [
      { freq: 392.0, duration: 0.16, gain: 0.10, type: "triangle" },
      { freq: 523.25, duration: 0.16, gain: 0.10, type: "triangle" },
      { freq: 783.99, duration: 0.12, gain: 0.13, type: "triangle", startAt: 0.10 },
    ],
  },
  {
    value: "crystal",
    label: "Crystal",
    description: "Three high glassy notes — bright and clean.",
    notes: [
      { freq: 1318.5, duration: 0.06, gain: 0.10 },
      { freq: 1568.0, duration: 0.06, gain: 0.11, startAt: 0.05 },
      { freq: 1975.5, duration: 0.10, gain: 0.12, startAt: 0.10 },
    ],
  },
  {
    value: "bloom",
    label: "Bloom",
    description: "A major chord opening — like a flower at dawn.",
    notes: [
      { freq: 523.25, duration: 0.20, gain: 0.10 },
      { freq: 659.25, duration: 0.20, gain: 0.10 },
      { freq: 783.99, duration: 0.20, gain: 0.10 },
    ],
  },
  {
    value: "glide",
    label: "Glide",
    description: "One long tone that effortlessly rises and lands.",
    notes: [
      { freq: 440.0, duration: 0.28, gain: 0.13, glideTo: 1318.5 },
    ],
  },
  {
    value: "sparkle",
    label: "Sparkle",
    description: "A four-note flourish — quick and joyful.",
    notes: [
      { freq: 1046.5, duration: 0.04, gain: 0.10, type: "triangle" },
      { freq: 1318.5, duration: 0.04, gain: 0.10, type: "triangle", startAt: 0.035 },
      { freq: 1568.0, duration: 0.04, gain: 0.10, type: "triangle", startAt: 0.07 },
      { freq: 2093.0, duration: 0.10, gain: 0.12, type: "triangle", startAt: 0.105 },
    ],
  },
  {
    value: "pulse",
    label: "Pulse",
    description: "A soft heartbeat — two gentle pulses.",
    notes: [
      { freq: 523.25, duration: 0.07, gain: 0.12 },
      { freq: 523.25, duration: 0.10, gain: 0.13, startAt: 0.10 },
      { freq: 783.99, duration: 0.10, gain: 0.13, startAt: 0.10 },
    ],
  },
];

/* ──────────────────── receive tones (10) ──────────────────── */

export const DEFAULT_RECEIVE_TONE_ID = "drift";

export const RECEIVE_TONES: ToneRecipe[] = [
  {
    value: "drift",
    label: "Drift",
    description: "VeilChat's classic descending three-note arrival.",
    notes: [
      { freq: 783.99, duration: 0.07, gain: 0.13 },
      { freq: 659.25, duration: 0.07, gain: 0.13, startAt: 0.06 },
      { freq: 523.25, duration: 0.14, gain: 0.13, startAt: 0.12 },
    ],
  },
  {
    value: "waterdrop",
    label: "Waterdrop",
    description: "A single round drop with a long settle.",
    notes: [
      { freq: 587.33, duration: 0.18, gain: 0.11, glideTo: 440 },
    ],
  },
  {
    value: "wisp",
    label: "Wisp",
    description: "A breath of air — soft glide downward.",
    notes: [
      { freq: 440.0, duration: 0.20, gain: 0.10, glideTo: 349.23 },
    ],
  },
  {
    value: "halo",
    label: "Halo",
    description: "A warm dyad — like a soft hand on the shoulder.",
    notes: [
      { freq: 523.25, duration: 0.18, gain: 0.10 },
      { freq: 659.25, duration: 0.18, gain: 0.10 },
    ],
  },
  {
    value: "lullaby",
    label: "Lullaby",
    description: "Three slow rising sines — calm and affirming.",
    notes: [
      { freq: 523.25, duration: 0.12, gain: 0.11 },
      { freq: 587.33, duration: 0.12, gain: 0.11, startAt: 0.11 },
      { freq: 659.25, duration: 0.18, gain: 0.12, startAt: 0.22 },
    ],
  },
  {
    value: "bell",
    label: "Bell",
    description: "A small temple bell — calm and grounded.",
    notes: [
      { freq: 880.0, duration: 0.08, gain: 0.12, type: "triangle" },
      { freq: 1318.5, duration: 0.10, gain: 0.13, type: "triangle", startAt: 0.07 },
      { freq: 880.0, duration: 0.16, gain: 0.10, type: "triangle", startAt: 0.16 },
    ],
  },
  {
    value: "petal",
    label: "Petal",
    description: "A short kiss of a note — barely a whisper.",
    notes: [
      { freq: 493.88, duration: 0.08, gain: 0.10 },
    ],
  },
  {
    value: "echo",
    label: "Echo",
    description: "One note, then a softer reflection of itself.",
    notes: [
      { freq: 698.46, duration: 0.10, gain: 0.13 },
      { freq: 698.46, duration: 0.14, gain: 0.07, startAt: 0.18 },
    ],
  },
  {
    value: "tide",
    label: "Tide",
    description: "A long descending wave — ocean meeting shore.",
    notes: [
      { freq: 587.33, duration: 0.28, gain: 0.12, glideTo: 392 },
    ],
  },
  {
    value: "mist",
    label: "Mist",
    description: "A high quiet sigh — present but never demanding.",
    notes: [
      { freq: 1318.5, duration: 0.10, gain: 0.08 },
    ],
  },
];

/* ──────────────────── lookups ──────────────────── */

export function getSendTone(id: string | null | undefined): ToneRecipe {
  if (!id) return SEND_TONES[0]!;
  return SEND_TONES.find((t) => t.value === id) ?? SEND_TONES[0]!;
}

export function getReceiveTone(id: string | null | undefined): ToneRecipe {
  if (!id) return RECEIVE_TONES[0]!;
  return RECEIVE_TONES.find((t) => t.value === id) ?? RECEIVE_TONES[0]!;
}
