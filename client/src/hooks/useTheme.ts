import { useContext } from "react";
import { ThemeContext } from "@/contexts/theme-context";

export function useTheme() {
  const context = useContext(ThemeContext);
  return context;
}
