import { create } from "zustand";
import type { UnlockedIdentity } from "./signal/session";

/**
 * In-memory only. Holds the user's decrypted identity private keys after
 * they enter their PIN. Cleared on tab refresh / logout — never persisted
 * to disk.
 */

interface UnlockState {
  identity: UnlockedIdentity | null;
  setIdentity: (id: UnlockedIdentity) => void;
  clear: () => void;
}

export const useUnlockStore = create<UnlockState>((set) => ({
  identity: null,
  setIdentity: (identity) => set({ identity }),
  clear: () => set({ identity: null }),
}));
