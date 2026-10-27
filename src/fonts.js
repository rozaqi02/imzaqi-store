/**
 * Self-hosted fonts — identical in Vite dev, Netlify build, and offline PWA.
 * Latin subsets only (Indonesian UI); replaces Google Fonts CDN.
 */
import bricolageLatinWght from "@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2?url";
import spaceGroteskLatin500 from "@fontsource/space-grotesk/files/space-grotesk-latin-500-normal.woff2?url";
import pjsLatin400 from "@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-400-normal.woff2?url";
import pjsLatin600 from "@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-600-normal.woff2?url";
import pjsLatin700 from "@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-700-normal.woff2?url";
import pjsLatin800 from "@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-800-normal.woff2?url";


import "@fontsource/plus-jakarta-sans/latin-300.css";
import "@fontsource/plus-jakarta-sans/latin-400.css";
import "@fontsource/plus-jakarta-sans/latin-500.css";
import "@fontsource/plus-jakarta-sans/latin-600.css";
import "@fontsource/plus-jakarta-sans/latin-700.css";
import "@fontsource/plus-jakarta-sans/latin-800.css";

import "@fontsource-variable/bricolage-grotesque/wght.css";

import "@fontsource/space-grotesk/latin-400.css";
import "@fontsource/space-grotesk/latin-500.css";
import "@fontsource/space-grotesk/latin-600.css";
import "@fontsource/space-grotesk/latin-700.css";

import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import "@fontsource/jetbrains-mono/latin-600.css";
import "@fontsource/jetbrains-mono/latin-700.css";
import "@fontsource/jetbrains-mono/latin-800.css";

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

preloadCriticalFont(bricolageLatinWght);
preloadCriticalFont(spaceGroteskLatin500);
preloadCriticalFont(pjsLatin400);
preloadCriticalFont(pjsLatin600);
preloadCriticalFont(pjsLatin700);
preloadCriticalFont(pjsLatin800);
