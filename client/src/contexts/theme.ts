import { createContext } from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export interface ThemeContextType {
  /** User selected mode: light, dark, or system */
  theme: Theme;
  /** Actual active mode after resolving system preference */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const defaultContext: ThemeContextType = {
  theme: "system",
  resolvedTheme: "dark",
  setTheme: () => {},
  toggleTheme: () => {},
};

export const ThemeContext = createContext<ThemeContextType>(defaultContext);
