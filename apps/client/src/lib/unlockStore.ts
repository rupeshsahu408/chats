import { create } from "zustand";
import type { UnlockedIdentity } from "./signal/session";
import {
  saveUnlockedIdentity,
  clearUnlockedIdentity,
  loadUnlockedIdentity,
} from "./db";
import { bytesToBase64, base64ToBytes } from "./crypto";

/**
 * Holds the user's decrypted identity private keys. After the first PIN /
 * recovery-phrase unlock we cache the decrypted keys in IndexedDB so the
 * user only ever has to enter the secret once per browser. This trades
 * some at-rest security for convenience — anyone with access to the
 * browser profile can read the keys.
 */

interface UnlockState {
  identity: UnlockedIdentity | null;
  /** Set the identity in memory AND persist a cached copy to IndexedDB. */
  setIdentity: (id: UnlockedIdentity) => Promise<void>;
  /** In-memory only (used while hydrating from cache during boot). */
  hydrate: (id: UnlockedIdentity) => void;
  /** Clear in-memory + on-disk cache. */
  clear: () => Promise<void>;
}

export const useUnlockStore = create<UnlockState>((set) => ({
  identity: null,
  setIdentity: async (identity) => {
    set({ identity });
    try {
      await saveUnlockedIdentity({
        id: "self",
        userId: identity.userId,
        ed25519PrivateKey: bytesToBase64(identity.ed25519.privateKey),
        ed25519PublicKey: bytesToBase64(identity.ed25519.publicKey),
        x25519PrivateKey: bytesToBase64(identity.x25519.privateKey),
        x25519PublicKey: bytesToBase64(identity.x25519.publicKey),
        savedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn("Failed to persist unlocked identity", e);
    }
  },
  hydrate: (identity) => set({ identity }),
  clear: async () => {
    set({ identity: null });
    try {
      await clearUnlockedIdentity();
    } catch {
      /* ignore */
    }
  },
}));

/** Read the cached unlocked identity, if any. Used at app boot. */
export async function loadCachedUnlockedIdentity(): Promise<UnlockedIdentity | null> {
  const rec = await loadUnlockedIdentity();
  if (!rec) return null;
  return {
    userId: rec.userId,
    ed25519: {
      privateKey: base64ToBytes(rec.ed25519PrivateKey),
      publicKey: base64ToBytes(rec.ed25519PublicKey),
    },
    x25519: {
      privateKey: base64ToBytes(rec.x25519PrivateKey),
      publicKey: base64ToBytes(rec.x25519PublicKey),
    },
  };
}
