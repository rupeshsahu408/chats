import { create } from "zustand";

/**
 * User preferences for the Veil in-app keyboard. Stored in localStorage
 * so the choice survives reloads but never leaves the device.
 *
 * The Veil keyboard is opt-in: by default everyone uses the system
 * keyboard. When enabled it replaces the system keyboard for chat
 * composers on touch devices, so keystrokes never pass through a
 * third-party IME (Gboard, SwiftKey, etc.) that might phone home.
 */
export interface KeyboardPrefs {
  /** Master toggle. When false, behavior is identical to before. */
  useVeilKeyboard: boolean;
  /**
   * If true, show a small ⌨ button in the composer that lets the user
   * temporarily flip back to the system keyboard for the current chat.
   * Useful escape hatch for autocomplete / dictation / language packs
   * the Veil keyboard doesn't ship.
   */
  showComposerSwitch: boolean;
}

const STORAGE_KEY = "veil:keyboard-prefs";
const DEFAULTS: KeyboardPrefs = {
  useVeilKeyboard: false,
  showComposerSwitch: true,
};

function readStored(): KeyboardPrefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<KeyboardPrefs>;
    return {
      useVeilKeyboard: Boolean(parsed.useVeilKeyboard),
      showComposerSwitch:
        parsed.showComposerSwitch === undefined
          ? DEFAULTS.showComposerSwitch
          : Boolean(parsed.showComposerSwitch),
    };
  } catch {
    return DEFAULTS;
  }
}

function writeStored(prefs: KeyboardPrefs): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore — quota / private browsing */
  }
}

interface KeyboardPrefsState extends KeyboardPrefs {
  set: (next: Partial<KeyboardPrefs>) => void;
}

export const useKeyboardPrefs = create<KeyboardPrefsState>((set, get) => ({
  ...readStored(),
  set: (next) => {
    const merged = { ...get(), ...next };
    const persisted: KeyboardPrefs = {
      useVeilKeyboard: merged.useVeilKeyboard,
      showComposerSwitch: merged.showComposerSwitch,
    };
    writeStored(persisted);
    set(persisted);
  },
}));

/**
 * Returns true on devices likely to have a touch keyboard as the
 * primary input method (phones, tablets). Desktop browsers with a
 * physical keyboard return false — there's no point swapping out
 * something that doesn't exist.
 */
export function isCoarsePointerDevice(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(pointer: coarse)").matches;
}
