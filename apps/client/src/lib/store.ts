import { create } from "zustand";
import type { PublicUser } from "@veil/shared";

interface AuthState {
  accessToken: string | null;
  user: PublicUser | null;
  setAuth: (auth: { accessToken: string; user: PublicUser }) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  setAuth: ({ accessToken, user }) => set({ accessToken, user }),
  clearAuth: () => set({ accessToken: null, user: null }),
}));
