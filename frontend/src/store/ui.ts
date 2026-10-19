import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

export type Theme = "dark" | "light";

interface UIState {
  theme: Theme;
  sidebarCollapsed: boolean;
  reviewer: string;
  paletteOpen: boolean;
  setTheme: (t: Theme) => void;
  toggleSidebar: () => void;
  setReviewer: (id: string) => void;
  setPaletteOpen: (open: boolean) => void;
}

// Storage can throw (private mode, blocked site data); fall back to memory silently.
const memory = new Map<string, string>();
const safeStorage: StateStorage = {
  getItem: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return memory.get(k) ?? null;
    }
  },
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      memory.set(k, v);
    }
  },
  removeItem: (k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      memory.delete(k);
    }
  },
};

export const useUI = create<UIState>()(
  persist(
    (set) => ({
      theme: "dark",
      sidebarCollapsed: false,
      reviewer: "asha",
      paletteOpen: false,
      setTheme: (theme) => set({ theme }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setReviewer: (reviewer) => set({ reviewer }),
      setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
    }),
    {
      name: "reglens-ui",
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ theme: s.theme, sidebarCollapsed: s.sidebarCollapsed, reviewer: s.reviewer }),
    },
  ),
);

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}
