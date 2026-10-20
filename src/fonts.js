/**
 * Self-hosted fonts — identical in Vite dev, Netlify build, and offline PWA.
 * Latin subsets only (Indonesian UI); replaces Google Fonts CDN.
 */
import interLatin400 from "@fontsource/inter/files/inter-latin-400-normal.woff2?url";
import pjsLatin400 from "@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-400-normal.woff2?url";
import pjsLatin600 from "@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-600-normal.woff2?url";
import pjsLatin700 from "@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-700-normal.woff2?url";
import pjsLatin800 from "@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-800-normal.woff2?url";

import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/inter/latin-800.css";

import "@fontsource/plus-jakarta-sans/latin-300.css";
import "@fontsource/plus-jakarta-sans/latin-400.css";
import "@fontsource/plus-jakarta-sans/latin-500.css";
import "@fontsource/plus-jakarta-sans/latin-600.css";
import "@fontsource/plus-jakarta-sans/latin-700.css";
import "@fontsource/plus-jakarta-sans/latin-800.css";

import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import "@fontsource/jetbrains-mono/latin-600.css";
import "@fontsource/jetbrains-mono/latin-700.css";
import "@fontsource/jetbrains-mono/latin-800.css";

import "@fontsource/outfit/latin-400.css";
import "@fontsource/outfit/latin-500.css";
import "@fontsource/outfit/latin-600.css";
import "@fontsource/outfit/latin-700.css";
import "@fontsource/outfit/latin-800.css";

import "@fontsource/poppins/latin-400.css";
import "@fontsource/poppins/latin-500.css";
import "@fontsource/poppins/latin-600.css";
import "@fontsource/poppins/latin-700.css";
import "@fontsource/poppins/latin-800.css";
import "@fontsource/poppins/latin-900.css";

import "@fontsource/montserrat/latin-700.css";
import "@fontsource/montserrat/latin-800.css";
import "@fontsource/montserrat/latin-900.css";

function preloadCriticalFont(href) {
  if (typeof document === "undefined" || !href) return;
  if (document.querySelector(`link[rel="preload"][href="${href}"]`)) return;

  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "font";
  link.type = "font/woff2";
  link.crossOrigin = "anonymous";
  link.href = href;
  document.head.appendChild(link);
}

preloadCriticalFont(interLatin400);
preloadCriticalFont(pjsLatin400);
preloadCriticalFont(pjsLatin600);
preloadCriticalFont(pjsLatin700);
preloadCriticalFont(pjsLatin800);
