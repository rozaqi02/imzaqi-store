import { useEffect, useState } from "react";

export function useIsMobile(breakpoint = "(max-width: 720px), (pointer: coarse)") {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(breakpoint).matches : false
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mq = window.matchMedia(breakpoint);
    const handler = (e) => setIsMobile(e.matches);

    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }

    mq.addListener(handler);
    return () => mq.removeListener(handler);
  }, [breakpoint]);

  return isMobile;
}

export function useDeviceCapability() {
  const [caps] = useState(() => {
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

  return caps;
}
