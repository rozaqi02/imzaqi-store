import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

const ThemeContext = createContext(null);
const STORAGE_KEY = "imzaqi-theme-v2";
const THEME_FADE_MS = 1000;

function shouldAnimateTheme() {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (document.documentElement.dataset.motion === "off") return false;
  return true;
}

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
  const fadeTimerRef = useRef(null);

  useEffect(() => {
    const root = document.documentElement;

    root.classList.add("no-theme-transition");
    root.dataset.theme = theme;
    root.style.colorScheme = theme;

    const frame = requestAnimationFrame(() => {
      if (!root.classList.contains("theme-fade-active")) {
        root.classList.remove("no-theme-transition");
      }
    });

    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {}

    return () => cancelAnimationFrame(frame);
  }, [theme]);

  useEffect(
    () => () => {
      if (fadeTimerRef.current != null) {
        window.clearTimeout(fadeTimerRef.current);
      }
    },
    []
  );

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === "dark",
      setTheme,
      toggleTheme: () => {
        const next = theme === "light" ? "dark" : "light";

        if (typeof document === "undefined" || !shouldAnimateTheme()) {
          setTheme(next);
          return;
        }

        const root = document.documentElement;

        if (fadeTimerRef.current != null) {
          window.clearTimeout(fadeTimerRef.current);
          fadeTimerRef.current = null;
          root.classList.remove("theme-fade-active", "theme-fade-out", "no-theme-transition");
          delete root.dataset.themeFade;
        }

        root.dataset.themeFade = next;
        root.classList.add("theme-fade-active", "no-theme-transition");

        flushSync(() => setTheme(next));

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            root.classList.add("theme-fade-out");
          });
        });

        fadeTimerRef.current = window.setTimeout(() => {
          fadeTimerRef.current = null;
          root.classList.remove("theme-fade-active", "theme-fade-out", "no-theme-transition");
          delete root.dataset.themeFade;
        }, THEME_FADE_MS);
      },
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