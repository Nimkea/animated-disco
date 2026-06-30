import { useEffect, useMemo, useState } from "react";
import { ThemeContext, type ResolvedTheme, type Theme } from "./theme";

const THEME_STORAGE_KEY = "xnrt-theme";

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function normalizeTheme(value: string | null): Theme {
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return "system";
}

function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === "system" ? getSystemTheme() : theme;
}

function applyTheme(theme: Theme, resolvedTheme: ResolvedTheme) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.classList.toggle("dark", resolvedTheme === "dark");
  root.dataset.theme = theme;
  root.dataset.resolvedTheme = resolvedTheme;
  root.style.colorScheme = resolvedTheme;

  const themeColor = resolvedTheme === "dark" ? "#0f172a" : "#f8fafc";
  const metaThemeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])');
  if (metaThemeColor) {
    metaThemeColor.content = themeColor;
  }
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "system";
  return normalizeTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);

  const resolvedTheme = useMemo<ResolvedTheme>(() => {
    return theme === "system" ? systemTheme : theme;
  }, [theme, systemTheme]);

  useEffect(() => {
    applyTheme(theme, resolvedTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme, resolvedTheme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => setSystemTheme(media.matches ? "dark" : "light");

    handleChange();
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState((prev) => {
      const currentResolved = prev === "system" ? getSystemTheme() : prev;
      return currentResolved === "dark" ? "light" : "dark";
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
