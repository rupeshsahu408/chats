import { create } from "zustand";

interface PresenceState {
  online: Record<string, boolean>;
  setOnline: (userId: string, online: boolean) => void;
  isOnline: (userId: string) => boolean;
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  online: {},
  setOnline: (userId, online) =>
    set((s) => ({ online: { ...s.online, [userId]: online } })),
  isOnline: (userId) => get().online[userId] === true,
}));
