import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types";

const TOKEN_KEY = "token";

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  setUser: (user: User | null) => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      setAuth: (user, token) => {
        if (typeof window !== "undefined") localStorage.setItem(TOKEN_KEY, token);
        set({ user, token });
      },
      clearAuth: () => {
        if (typeof window !== "undefined") localStorage.removeItem(TOKEN_KEY);
        set({ user: null, token: null });
      },
      setUser: (user) => set({ user }),
      isAuthenticated: () => !!get().token,
    }),
    {
      name: "auth-storage",
      partialize: (s) => ({ token: s.token, user: s.user }),
      onRehydrateStorage: () => (state) => {
        if (state?.token && typeof window !== "undefined") {
          localStorage.setItem(TOKEN_KEY, state.token);
        }
      },
    }
  )
);
