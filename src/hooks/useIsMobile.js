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
  // BUG-07: tambah reaktivitas saat orientasi berubah
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

    const update = () => {
      setCaps({
        isMobile:
          window.matchMedia("(pointer: coarse)").matches ||
          window.matchMedia("(max-width: 720px)").matches,
        isReducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        saveData: Boolean(navigator.connection && navigator.connection.saveData),
        lowMemory: typeof navigator.deviceMemory === "number" && navigator.deviceMemory <= 2,
      });
    };

    // BUG-14: subscribe prefers-reduced-motion changes
    const reducedMotionMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionMq.addEventListener("change", update);

    window.addEventListener("orientationchange", update);
    window.addEventListener("resize", update);
    return () => {
      reducedMotionMq.removeEventListener("change", update);
      window.removeEventListener("orientationchange", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return caps;
}
