import { create } from "zustand";

export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "veil:theme";

function readStored(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
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
