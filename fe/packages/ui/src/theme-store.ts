import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "system";

/**
 * localStorage key for the persisted theme — the SINGLE source of truth.
 * Generic on purpose (not project-branded) so a new project needs no change here.
 * The pre-paint FOUC guard in index.html hardcodes this same literal (it can't
 * import); if you change it here, change it there too AND regenerate the CSP
 * script-src hash in deploy/nginx.conf (see README).
 */
export const THEME_KEY = "ui-theme";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

/** Global UI state only (per §3): the chosen theme, persisted to localStorage. */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "system",
      setTheme: (theme) => set({ theme }),
    }),
    { name: THEME_KEY },
  ),
);

function resolveDark(theme: Theme): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Applies the `.dark` class on <html> and keeps it in sync with store + OS. */
export function useThemeInit(): void {
  const theme = useThemeStore((s) => s.theme);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolveDark(theme));
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => document.documentElement.classList.toggle("dark", mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);
}
