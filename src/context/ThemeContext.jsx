import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext(null);
const STORAGE_KEY = "imzaqi-theme-v2";

function getInitialTheme() {
  if (typeof document !== "undefined") {
    const preset = document.documentElement.dataset.theme;
    if (preset === "light" || preset === "dark") return preset;
  }
  if (typeof window === "undefined") return "light";
  let saved = "";
  try {
    saved = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    saved = "";
  }
  return saved === "light" || saved === "dark" ? saved : "light";
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {}
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === "dark",
      setTheme,
      toggleTheme: () => setTheme((current) => (current === "light" ? "dark" : "light")),
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error("useTheme must be used inside ThemeProvider.");
  }
  return value;
}
