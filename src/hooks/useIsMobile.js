import { useEffect, useState } from "react";

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mq = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);

    // BUG-15: addListener deprecated di Chrome 108+ — pakai addEventListener selalu
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

// BUG-04: compound media query "(max-width: 720px), (pointer: coarse)" dalam satu
// matchMedia hanya fire change event untuk query pertama di WebKit lama.
// Split jadi dua listener terpisah.
export function useIsMobile(breakpoint = "(max-width: 720px), (pointer: coarse)") {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(breakpoint).matches : false
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    // Cek apakah ini compound query — split untuk reliability
    const parts = breakpoint.split(/,\s*(?=\()/);
    if (parts.length > 1) {
      const mqs = parts.map((p) => window.matchMedia(p.trim()));
      const sync = () => setIsMobile(mqs.some((mq) => mq.matches));
      mqs.forEach((mq) => mq.addEventListener("change", sync));
      return () => mqs.forEach((mq) => mq.removeEventListener("change", sync));
    }

    const mq = window.matchMedia(breakpoint);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [breakpoint]);

  return isMobile;
}

export function useDeviceCapability() {
  const [caps, setCaps] = useState(() => {
    if (typeof window === "undefined") {
      return { isMobile: false, isReducedMotion: false, saveData: false, lowMemory: false };
    }
    return {
      isMobile:
        window.matchMedia("(pointer: coarse)").matches ||
        window.matchMedia("(max-width: 720px)").matches,
      isReducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      saveData: Boolean(navigator.connection && navigator.connection.saveData),
      lowMemory: typeof navigator.deviceMemory === "number" && navigator.deviceMemory <= 2,
    };
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mqMobile = window.matchMedia("(max-width: 720px)");
    const mqCoarse = window.matchMedia("(pointer: coarse)");
    const mqReduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    const update = () => {
      const isMobile = mqCoarse.matches || mqMobile.matches;
      const isReducedMotion = mqReduced.matches;
      const saveData = Boolean(navigator.connection && navigator.connection.saveData);
      const lowMemory = typeof navigator.deviceMemory === "number" && navigator.deviceMemory <= 2;

      setCaps((prev) => {
        if (
          prev.isMobile === isMobile &&
          prev.isReducedMotion === isReducedMotion &&
          prev.saveData === saveData &&
          prev.lowMemory === lowMemory
        ) {
          return prev;
        }
        return { isMobile, isReducedMotion, saveData, lowMemory };
      });
    };

    mqMobile.addEventListener("change", update);
    mqCoarse.addEventListener("change", update);
    mqReduced.addEventListener("change", update);
    window.addEventListener("orientationchange", update);

    return () => {
      mqMobile.removeEventListener("change", update);
      mqCoarse.removeEventListener("change", update);
      mqReduced.removeEventListener("change", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return caps;
}
