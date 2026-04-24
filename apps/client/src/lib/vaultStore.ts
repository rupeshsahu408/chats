import { create } from "zustand";

/**
 * Session-scoped unlock state for the Vault.
 *
 * The Vault is a separate inbox of hidden chats. Enrolment and the
 * "is the vault enabled" flag both live in `userPrefs` (durable,
 * survives reload). This store only tracks whether the user has
 * authenticated *this session* — closing the tab re-locks the
 * vault, so a stolen device that's still signed into Veil can't
 * reveal the hidden chats without the owner's biometric.
 *
 * The actual list of vaulted chats is filtered out of the main
 * chat list whenever `unlocked === false`, so even a screenshot of
 * the chats screen won't reveal hidden conversations.
 */
interface VaultState {
  unlocked: boolean;
  unlock: () => void;
  lock: () => void;
}

export const useVaultStore = create<VaultState>((set) => ({
  unlocked: false,
  unlock: () => set({ unlocked: true }),
  lock: () => set({ unlocked: false }),
}));
