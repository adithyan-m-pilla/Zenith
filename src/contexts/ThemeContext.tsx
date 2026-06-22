import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type AppTheme = "emerald" | "gold" | "mono" | "light" | "ocean" | "rose";

export const THEMES: { id: AppTheme; name: string; swatch: string[] }[] = [
  { id: "emerald", name: "Emerald (Original)", swatch: ["#0f1715", "#10b981", "#1f2a26"] },
  { id: "gold", name: "Gold Noir", swatch: ["#0d0b08", "#d4a84c", "#1c1810"] },
  { id: "mono", name: "Black & White", swatch: ["#0a0a0a", "#ffffff", "#1f1f1f"] },
  { id: "light", name: "Daylight", swatch: ["#fafafa", "#10b981", "#e5e7eb"] },
  { id: "ocean", name: "Deep Ocean", swatch: ["#0a1a2e", "#38bdf8", "#1e3a5f"] },
  { id: "rose", name: "Rose Dusk", swatch: ["#1a0d14", "#ec4899", "#2d1822"] },
];

const KEY = "zenith-app-theme";

interface Ctx {
  theme: AppTheme;
  setTheme: (t: AppTheme) => void;
}
const ThemeCtx = createContext<Ctx | null>(null);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    const v = (typeof window !== "undefined" && localStorage.getItem(KEY)) as AppTheme | null;
    return v && THEMES.some((t) => t.id === v) ? v : "emerald";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "emerald") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    localStorage.setItem(KEY, theme);
  }, [theme]);

  return <ThemeCtx.Provider value={{ theme, setTheme: setThemeState }}>{children}</ThemeCtx.Provider>;
};

export const useAppTheme = () => {
  const v = useContext(ThemeCtx);
  if (!v) throw new Error("useAppTheme must be used inside ThemeProvider");
  return v;
};
