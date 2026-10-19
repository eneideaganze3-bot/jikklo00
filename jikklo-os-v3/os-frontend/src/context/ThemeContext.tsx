import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type ThemeChoice = "light" | "dark" | "auto";

const STORAGE_KEY = "jikklo_os_theme";

type ThemeContextType = {
  theme: ThemeChoice;
  setTheme: (t: ThemeChoice) => void;
  cycleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

function resolveIsDark(theme: ThemeChoice): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  // "auto" ("Miroir") : reflète le réglage clair/sombre du système, comme
  // le mode Automatique des appareils Apple.
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function applyTheme(theme: ThemeChoice) {
  document.documentElement.classList.toggle("dark", resolveIsDark(theme));
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" || stored === "auto" ? stored : "light";
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);

    if (theme !== "auto" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => applyTheme("auto");
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, [theme]);

  function setTheme(t: ThemeChoice) {
    setThemeState(t);
  }

  function cycleTheme() {
    setThemeState((prev) => (prev === "light" ? "dark" : prev === "dark" ? "auto" : "light"));
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, cycleTheme }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme doit être utilisé dans ThemeProvider");
  return ctx;
}
