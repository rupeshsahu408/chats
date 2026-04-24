import { create } from "zustand";
import { getUserPrefs, setUserPrefs, type UserPrefRecord } from "./db";
import { setSoundEnabled, setSoundVolume } from "./sound";
import { setHapticsEnabled } from "./haptics";

/** Sync the global sound/haptics modules with the latest prefs. */
function syncFeedbackModules(prefs: UserPrefRecord | null): void {
  setSoundEnabled(prefs?.soundEnabled ?? true);
  setHapticsEnabled(prefs?.hapticsEnabled ?? true);
  if (typeof prefs?.soundVolume === "number") {
    setSoundVolume(prefs.soundVolume);
  }
}

/**
 * Reactive store for the global stealth/privacy toggles. Hydrates from
 * Dexie on first read; writes go through `setUserPrefs` so they
 * persist across reloads.
 */

interface StealthState {
  prefs: UserPrefRecord | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  set: (patch: Partial<Omit<UserPrefRecord, "id" | "updatedAt">>) => Promise<void>;
}

export const useStealthPrefs = create<StealthState>((set, get) => ({
  prefs: null,
  hydrated: false,
  async hydrate() {
    if (get().hydrated) return;
    const prefs = await getUserPrefs();
    syncFeedbackModules(prefs);
    set({ prefs, hydrated: true });
  },
  async set(patch) {
    const next = await setUserPrefs(patch);
    syncFeedbackModules(next);
    set({ prefs: next });
  },
}));

/** Synchronous read of the cached prefs, falling back to safe defaults. */
export function getCachedStealthPrefs(): UserPrefRecord {
  return (
    useStealthPrefs.getState().prefs ?? {
      id: "self",
      readReceiptsEnabled: true,
      typingIndicatorsEnabled: true,
      screenshotBlurEnabled: true,
      appLockEnabled: false,
      soundEnabled: true,
      hapticsEnabled: true,
      updatedAt: new Date(0).toISOString(),
    }
  );
}
