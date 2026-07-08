/**
 * Self-hosted fonts — identical in Vite dev, Netlify build, and offline PWA.
 * Latin subsets only (Indonesian UI); replaces Google Fonts CDN.
 */
import plusJakartaLatin400 from "@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-400-normal.woff2?url";

import "@fontsource/plus-jakarta-sans/latin-400.css";
import "@fontsource/plus-jakarta-sans/latin-600.css";
import "@fontsource/plus-jakarta-sans/latin-700.css";

import "@fontsource/outfit/latin-600.css";
import "@fontsource/outfit/latin-700.css";

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

preloadCriticalFont(plusJakartaLatin400);