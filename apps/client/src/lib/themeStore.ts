import { create } from "zustand";

export const THEMES = [
  "system",
  "light",
  "dark",
  "reading",
  "rose",
  "green",
  "garden",
  "ocean",
] as const;

export type ThemeMode = (typeof THEMES)[number];
export type ResolvedTheme = Exclude<ThemeMode, "system">;

const STORAGE_KEY = "veil:theme";

function isThemeMode(v: unknown): v is ThemeMode {
  return typeof v === "string" && (THEMES as readonly string[]).includes(v);
}

function readStored(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (isThemeMode(v)) return v;
  } catch {
    /* ignore */
  }
  return "system";
}

function writeStored(mode: ThemeMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolve(mode: ThemeMode): ResolvedTheme {
  if (mode === "system") return systemPrefersDark() ? "dark" : "light";
  return mode;
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
  /** Re-resolve when system preference changes. */
  syncFromSystem: () => void;
}

const initialMode = typeof window !== "undefined" ? readStored() : "system";
const initialResolved = resolve(initialMode);
if (typeof document !== "undefined") apply(initialResolved);

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: initialMode,
  resolved: initialResolved,
  setMode: (mode) => {
    writeStored(mode);
    const resolved = resolve(mode);
    apply(resolved);
    set({ mode, resolved });
  },
  syncFromSystem: () => {
    if (get().mode !== "system") return;
    const resolved = resolve("system");
    apply(resolved);
    set({ resolved });
  },
}));

/** Mounts a listener that re-resolves when the OS theme flips. */
export function installSystemThemeListener(): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => useThemeStore.getState().syncFromSystem();
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
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
