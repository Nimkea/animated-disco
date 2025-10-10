import { createContext } from "react";

export type Theme = "light" | "dark";

export interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const defaultContext: ThemeContextType = {
  theme: "dark",
  setTheme: () => {},
  toggleTheme: () => {},
};

export const ThemeContext = createContext<ThemeContextType>(defaultContext);
