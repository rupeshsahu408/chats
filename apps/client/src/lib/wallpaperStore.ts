import type { CSSProperties } from "react";
import { create } from "zustand";

/**
 * Per-device chat wallpaper preference. Stored in localStorage so it
 * follows the user across sessions on the same device but never leaves
 * it (consistent with the VeilChat "private by design" stance — wallpapers
 * are aesthetic, not part of identity, and shouldn't be synced).
 *
 * - "default" — plain `--wa-bg` (no pattern) — calm, WhatsApp-Web-style.
 * - "solid"   — a flat solid colour the user picked.
 * - "dots"    — a dotted pattern over `--wa-bg`, dot colour user-picked.
 * - "image"   — a user-uploaded image stored as a data URL.
 */
export type WallpaperKind = "default" | "solid" | "dots" | "image";

export interface WallpaperPref {
  kind: WallpaperKind;
  /** Hex colour for "solid" or dot accent for "dots". */
  color?: string;
  /** Data URL for "image" (resized + JPEG-encoded before storage). */
  imageData?: string;
}

/** A scope key identifies a single chat surface. */
export type ChatScope =
  | { type: "dm"; peerId: string }
  | { type: "group"; groupId: string };

const STORAGE_KEY_GLOBAL = "veil:wallpaper";
const STORAGE_KEY_OVERRIDES = "veil:wallpaper:overrides";
const DEFAULT_PREF: WallpaperPref = { kind: "default" };

/** Curated palette of theme-friendly solid backgrounds. */
export const SOLID_PALETTE: { value: string; label: string }[] = [
  { value: "#0B141A", label: "Midnight" },
  { value: "#102536", label: "Deep ocean" },
  { value: "#1B1B2A", label: "Slate" },
  { value: "#F0F2F5", label: "Pearl" },
  { value: "#F7F1E3", label: "Sepia" },
  { value: "#EFE7DD", label: "Linen" },
  { value: "#E7F0E5", label: "Sage mist" },
  { value: "#E8EEF7", label: "Sky mist" },
  { value: "#F5E6EA", label: "Blush" },
];

/** Dot-colour swatches used when kind === "dots". */
export const DOT_PALETTE: { value: string; label: string }[] = [
  { value: "#00A884", label: "VeilChat green" },
  { value: "#38BDF8", label: "Sky" },
  { value: "#E11D48", label: "Rose" },
  { value: "#8B6F47", label: "Sepia" },
  { value: "#5B7553", label: "Sage" },
  { value: "#9333EA", label: "Violet" },
];

function isWallpaperPref(v: unknown): v is WallpaperPref {
  if (!v || typeof v !== "object") return false;
  const k = (v as { kind?: unknown }).kind;
  return k === "default" || k === "solid" || k === "dots" || k === "image";
}

function readStoredGlobal(): WallpaperPref {
  if (typeof window === "undefined") return DEFAULT_PREF;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GLOBAL);
    if (!raw) return DEFAULT_PREF;
    const parsed = JSON.parse(raw) as unknown;
    if (isWallpaperPref(parsed)) return parsed;
  } catch {
    /* ignore */
  }
  return DEFAULT_PREF;
}

function readStoredOverrides(): Record<string, WallpaperPref> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY_OVERRIDES);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, WallpaperPref> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (isWallpaperPref(v)) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function writeStoredGlobal(pref: WallpaperPref): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY_GLOBAL, JSON.stringify(pref));
}

function writeStoredOverrides(overrides: Record<string, WallpaperPref>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY_OVERRIDES, JSON.stringify(overrides));
}

/** Build the localStorage key suffix for a chat scope. */
export function scopeKey(scope: ChatScope): string {
  return scope.type === "dm" ? `dm:${scope.peerId}` : `group:${scope.groupId}`;
}

interface WallpaperState {
  /** Global default wallpaper, used when a chat has no override. */
  pref: WallpaperPref;
  /** Per-chat overrides keyed by scopeKey(scope). */
  overrides: Record<string, WallpaperPref>;
  setPref: (pref: WallpaperPref) => void;
  reset: () => void;
  setChatPref: (scope: ChatScope, pref: WallpaperPref) => void;
  /** Drop the per-chat override so the chat falls back to the global pref. */
  clearChatPref: (scope: ChatScope) => void;
}

export const useWallpaperStore = create<WallpaperState>((set, get) => ({
  pref: readStoredGlobal(),
  overrides: readStoredOverrides(),
  setPref: (pref) => {
    writeStoredGlobal(pref);
    set({ pref });
  },
  reset: () => {
    writeStoredGlobal(DEFAULT_PREF);
    set({ pref: DEFAULT_PREF });
  },
  setChatPref: (scope, pref) => {
    const key = scopeKey(scope);
    const next = { ...get().overrides, [key]: pref };
    writeStoredOverrides(next);
    set({ overrides: next });
  },
  clearChatPref: (scope) => {
    const key = scopeKey(scope);
    const current = get().overrides;
    if (!(key in current)) return;
    const next = { ...current };
    delete next[key];
    writeStoredOverrides(next);
    set({ overrides: next });
  },
}));

/**
 * React hook: returns the effective wallpaper for a chat scope.
 *
 * If an override exists for that scope, returns it together with
 * `hasOverride: true`. Otherwise falls back to the global pref.
 */
export function useEffectiveWallpaper(scope: ChatScope | null): {
  pref: WallpaperPref;
  hasOverride: boolean;
} {
  const global = useWallpaperStore((s) => s.pref);
  const overrides = useWallpaperStore((s) => s.overrides);
  if (!scope) return { pref: global, hasOverride: false };
  const key = scopeKey(scope);
  const override = overrides[key];
  return override
    ? { pref: override, hasOverride: true }
    : { pref: global, hasOverride: false };
}

/**
 * Compute the inline style for the chat scroll container. Returning an
 * inline style (rather than swapping className) keeps the markup simple
 * and lets per-user picks override the theme's default pattern cleanly.
 */
export function getWallpaperStyle(pref: WallpaperPref): CSSProperties {
  switch (pref.kind) {
    case "solid":
      return { backgroundColor: pref.color ?? "rgb(var(--wa-bg))" };
    case "dots": {
      const dot = pref.color ?? "rgb(var(--wa-wallpaper-dot))";
      return {
        backgroundColor: "rgb(var(--wa-bg))",
        backgroundImage: `radial-gradient(${withAlpha(dot, 0.35)} 1px, transparent 1px)`,
        backgroundSize: "18px 18px",
      };
    }
    case "image":
      if (pref.imageData) {
        return {
          backgroundColor: "rgb(var(--wa-bg))",
          backgroundImage: `url("${pref.imageData}")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        };
      }
      return defaultStyle();
    case "default":
    default:
      return defaultStyle();
  }
}

function defaultStyle(): CSSProperties {
  // The default is intentionally plain (no pattern) for a calm,
  // WhatsApp-Web-style chat surface. Users who want a textured
  // background can switch to "Dotted" from the wallpaper picker.
  return {
    backgroundColor: "rgb(var(--wa-bg))",
  };
}

/** Convert a #RRGGBB hex colour to an rgba() string with the given alpha. */
function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Read a user-selected file, resize it to a max edge, and return a
 * JPEG data URL. Resizing keeps localStorage well below its 5 MB
 * quota — even high-res phone photos compress to ~150-300 KB at
 * 1080px / quality 0.78.
 */
export async function fileToCompressedDataUrl(
  file: File,
  options: { maxEdge?: number; quality?: number } = {},
): Promise<string> {
  const { maxEdge = 1080, quality = 0.78 } = options;
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file (JPG, PNG, or WebP).");
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    throw new Error("Your browser couldn't process this image.");
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", quality);
}
