import { create } from "zustand";

export const THEMES = [
  "light",
  "dark",
  "reading",
  "rose",
  "green",
  "garden",
  "ocean",
] as const;

export type ThemeMode = (typeof THEMES)[number];
/**
 * `ResolvedTheme` used to differ from `ThemeMode` when "system" was a valid
 * mode. The system-following behaviour has been removed — the app now always
 * defaults to the light theme regardless of the OS preference, and the user
 * picks any other theme explicitly from Settings. The two types are kept as
 * an alias to minimise churn at call sites.
 */
export type ResolvedTheme = ThemeMode;

const STORAGE_KEY = "veil:theme";
const DEFAULT_MODE: ThemeMode = "light";

function isThemeMode(v: unknown): v is ThemeMode {
  return typeof v === "string" && (THEMES as readonly string[]).includes(v);
}

function readStored(): ThemeMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_MODE;
    if (isThemeMode(raw)) return raw;
    // Migration: legacy "system" preference now resolves to the default
    // light theme. Persist the migration so we don't keep reading "system".
    if (raw === "system") {
      try {
        localStorage.setItem(STORAGE_KEY, DEFAULT_MODE);
      } catch {
        /* ignore */
      }
      return DEFAULT_MODE;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_MODE;
}

function writeStored(mode: ThemeMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

function apply(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);
}

interface ThemeState {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
}

const initialMode = typeof window !== "undefined" ? readStored() : DEFAULT_MODE;
if (typeof document !== "undefined") apply(initialMode);

export const useThemeStore = create<ThemeState>((set) => ({
  mode: initialMode,
  resolved: initialMode,
  setMode: (mode) => {
    writeStored(mode);
    apply(mode);
    set({ mode, resolved: mode });
  },
}));

/**
 * No-op kept for backwards compatibility with call sites that previously
 * mounted a `prefers-color-scheme` listener. The app no longer follows the
 * OS theme — users explicitly pick a theme from Settings.
 */
export function installSystemThemeListener(): () => void {
  return () => {};
}

/** Static metadata for the theme picker UI. Swatches are CSS color literals
 *  used purely for the preview circles — the live theme tokens come from
 *  styles.css via [data-theme="…"] selectors. */
export interface ThemeMeta {
  value: ResolvedTheme;
  label: string;
  description: string;
  /** [background, accent, outgoing-bubble] preview swatches. */
  swatches: [string, string, string];
}

export const THEME_META: ThemeMeta[] = [
  {
    value: "light",
    label: "Light",
    description: "Bright & classic",
    swatches: ["#F0F2F5", "#00A884", "#D9FDD3"],
  },
  {
    value: "dark",
    label: "Dark",
    description: "Easy on the eyes at night",
    swatches: ["#0B141A", "#00A884", "#005C4B"],
  },
  {
    value: "reading",
    label: "Reading",
    description: "Warm sepia, low strain",
    swatches: ["#F7F1E3", "#8B6F47", "#EFE1C2"],
  },
  {
    value: "rose",
    label: "Rose",
    description: "Soft pink, calming",
    swatches: ["#FFF1F3", "#E11D48", "#FBCFD6"],
  },
  {
    value: "green",
    label: "Green",
    description: "Fresh & vibrant",
    swatches: ["#F0FDF4", "#16A34A", "#BBF7D0"],
  },
  {
    value: "garden",
    label: "Garden",
    description: "Earthy sage tones",
    swatches: ["#F1F5EC", "#5B7553", "#D6E4C8"],
  },
  {
    value: "ocean",
    label: "Ocean",
    description: "Deep blue, focused",
    swatches: ["#0C1B2A", "#38BDF8", "#134869"],
  },
];
