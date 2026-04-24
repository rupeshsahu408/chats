/**
 * Per-contact "personality": accent color + notification sound pack.
 *
 * Lives entirely on-device — like wallpaper, this is a local
 * preference (`chatPrefs.chatAccent` / `chatPrefs.notificationSound`)
 * and never crosses the encryption boundary. Mom can have a warm
 * orange chime, the office contact a minimal grey tick.
 */

export interface AccentSwatch {
  /** Stable key stored in `chatPrefs.chatAccent`. */
  value: string;
  label: string;
  /** CSS color the swatch + accent overrides actually use. */
  hex: string;
  /** Slightly darker variant for the "hover/pressed" state. */
  hexDark: string;
}

/**
 * Curated palette. Each accent picks a hue that reads well on both
 * the light and dark Veil themes — no neon, no muddy mid-tones.
 * The first entry ("default") means "use the global theme color"
 * and is rendered as a neutral swatch in the picker.
 */
export const ACCENT_SWATCHES: AccentSwatch[] = [
  { value: "default", label: "Default",  hex: "#00A884", hexDark: "#008F71" },
  { value: "warm",    label: "Warm",     hex: "#F59E0B", hexDark: "#D97706" },
  { value: "rose",    label: "Rose",     hex: "#E11D48", hexDark: "#BE123C" },
  { value: "lavender",label: "Lavender", hex: "#8B5CF6", hexDark: "#7C3AED" },
  { value: "ocean",   label: "Ocean",    hex: "#0EA5E9", hexDark: "#0284C7" },
  { value: "forest",  label: "Forest",   hex: "#16A34A", hexDark: "#15803D" },
  { value: "graphite",label: "Graphite", hex: "#64748B", hexDark: "#475569" },
  { value: "sand",    label: "Sand",     hex: "#A78161", hexDark: "#8B6644" },
];

export function getAccentSwatch(value: string | undefined | null): AccentSwatch {
  if (!value || value === "default") return ACCENT_SWATCHES[0]!;
  return (
    ACCENT_SWATCHES.find((s) => s.value === value) ?? ACCENT_SWATCHES[0]!
  );
}

/**
 * Sound pack metadata. The actual tone synthesis lives in `sound.ts`
 * — `playReceiveTone(packKey)` reads from this list to pick the right
 * frequencies / oscillator types. Keeping the metadata here means
 * the UI can render labels + descriptions without importing audio.
 */
export interface SoundPack {
  value: string;
  label: string;
  description: string;
  /** Three rising/falling notes in Hz that define the receive motif. */
  notes: [number, number, number];
  /** "sine" = soft & vocal; "triangle" = a touch brighter. */
  oscillator: OscillatorType;
  /** Per-note duration in seconds. Tiny ↑ for a more present feel. */
  duration: number;
  /** Peak gain (0..1). Quieter packs make ideal "office" sounds. */
  gain: number;
}

export const SOUND_PACKS: SoundPack[] = [
  {
    value: "default",
    label: "Default",
    description: "Veil's soft 3-note motif",
    notes: [783.99, 659.25, 523.25], // G5 → E5 → C5
    oscillator: "sine",
    duration: 0.07,
    gain: 0.13,
  },
  {
    value: "warm",
    label: "Warm chime",
    description: "Round, golden — good for family",
    notes: [523.25, 659.25, 783.99], // C5 → E5 → G5 (rising, warmer)
    oscillator: "sine",
    duration: 0.09,
    gain: 0.16,
  },
  {
    value: "minimal",
    label: "Minimal tick",
    description: "Single quiet click — distraction-free",
    notes: [1320, 1320, 1320], // single repeated note, very short
    oscillator: "triangle",
    duration: 0.025,
    gain: 0.07,
  },
  {
    value: "bell",
    label: "Bell",
    description: "Crisp ding — cuts through noise",
    notes: [880, 1318.5, 880], // A5 → E6 → A5
    oscillator: "triangle",
    duration: 0.08,
    gain: 0.15,
  },
  {
    value: "playful",
    label: "Playful",
    description: "Rising chirp — friends & group chats",
    notes: [659.25, 880, 1175],  // E5 → A5 → D6
    oscillator: "sine",
    duration: 0.06,
    gain: 0.14,
  },
  {
    value: "silent",
    label: "Silent",
    description: "No sound at all (haptic still fires)",
    notes: [0, 0, 0],
    oscillator: "sine",
    duration: 0,
    gain: 0,
  },
];

export function getSoundPack(value: string | undefined | null): SoundPack {
  if (!value || value === "default") return SOUND_PACKS[0]!;
  return SOUND_PACKS.find((p) => p.value === value) ?? SOUND_PACKS[0]!;
}
