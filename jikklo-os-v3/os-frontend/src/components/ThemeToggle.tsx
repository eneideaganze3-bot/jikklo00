import { useTheme } from "../context/ThemeContext";

const LABELS: Record<string, string> = { light: "Clair", dark: "Sombre", auto: "Miroir" };

// "Miroir" = mode automatique qui reflète le réglage clair/sombre de
// l'appareil, comme le mode Automatique des appareils Apple.
export function ThemeToggle() {
  const { theme, cycleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={cycleTheme}
      title={`Thème : ${LABELS[theme]} — cliquer pour changer`}
      className="flex items-center gap-2 text-xs text-white/60 hover:text-white transition-colors"
    >
      {theme === "light" && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.4M12 19.1v2.4M4.4 4.4l1.7 1.7M17.9 17.9l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.4 19.6l1.7-1.7M17.9 6.1l1.7-1.7" />
        </svg>
      )}
      {theme === "dark" && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      )}
      {theme === "auto" && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M12 3a9 9 0 1 0 0 18 6.5 6.5 0 0 1 0-18Z" />
        </svg>
      )}
      <span>{LABELS[theme]}</span>
    </button>
  );
}
