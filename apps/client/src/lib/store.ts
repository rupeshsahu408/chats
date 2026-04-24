import { create } from "zustand";
import type { PublicUser } from "@veil/shared";

const STORAGE_KEY = "veil:auth";

interface PersistedAuth {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
  /** Epoch ms after which the refresh token is no longer valid. */
  refreshExpiresAt: number;
}

function loadPersisted(): PersistedAuth | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedAuth;
    if (
      !parsed ||
      typeof parsed.accessToken !== "string" ||
      typeof parsed.refreshToken !== "string" ||
      !parsed.user ||
      typeof parsed.refreshExpiresAt !== "number"
    ) {
      return null;
    }
    if (parsed.refreshExpiresAt <= Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function savePersisted(value: PersistedAuth | null): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (value) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* storage may be disabled (private mode) — ignore */
  }
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: PublicUser | null;
  setAuth: (auth: {
    accessToken: string;
    refreshToken: string;
    user: PublicUser;
    /** Seconds until the refresh token expires (server-provided). */
    refreshExpiresIn: number;
  }) => void;
  clearAuth: () => void;
}

const initial = loadPersisted();

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: initial?.accessToken ?? null,
  refreshToken: initial?.refreshToken ?? null,
  user: initial?.user ?? null,
  setAuth: ({ accessToken, refreshToken, user, refreshExpiresIn }) => {
    savePersisted({
      accessToken,
      refreshToken,
      user,
      refreshExpiresAt: Date.now() + refreshExpiresIn * 1000,
    });
    set({ accessToken, refreshToken, user });
  },
  clearAuth: () => {
    savePersisted(null);
    set({ accessToken: null, refreshToken: null, user: null });
  },
}));

/** Returns the persisted refresh token without mounting the store. */
export function getStoredRefreshToken(): string | null {
  return loadPersisted()?.refreshToken ?? null;
}

/**
 * Returns the persisted refresh-token expiry as an epoch-ms timestamp,
 * or `null` if no auth is stored / the value is missing. Used by the
 * Under-the-Hood transparency screen to render a live countdown
 * without subscribing the rest of the app to expiry changes.
 */
export function getStoredRefreshExpiresAt(): number | null {
  return loadPersisted()?.refreshExpiresAt ?? null;
}
