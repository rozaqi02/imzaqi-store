import { useEffect, useState } from "react";
import { PHONE_LAYOUT_MEDIA, TABLET_LAYOUT_MEDIA } from "../lib/breakpoints";

export function detectMotionMode() {
  if (typeof window === "undefined" || !window.matchMedia) return "full";

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReduced) return "off";

  // iPad Pro / Air / Mini: keep full visual profile (backdrop blur, glass panels).
  if (window.matchMedia(TABLET_LAYOUT_MEDIA).matches) return "full";

  if (window.matchMedia(PHONE_LAYOUT_MEDIA).matches) return "lite";

  const mobileLike =
    window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(max-width: 920px)").matches;
  if (mobileLike) return "lite";

  return "full";
}

export function useAdaptiveMotion() {
  const [motionMode, setMotionMode] = useState(() => detectMotionMode());

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;

    const mediaQueries = [
      window.matchMedia("(prefers-reduced-motion: reduce)"),
      window.matchMedia(TABLET_LAYOUT_MEDIA),
      window.matchMedia(PHONE_LAYOUT_MEDIA),
      window.matchMedia("(pointer: coarse)"),
      window.matchMedia("(max-width: 920px)"),
    ];

    const sync = () => setMotionMode(detectMotionMode());
    sync();

    mediaQueries.forEach((query) => {
      if (typeof query.addEventListener === "function") query.addEventListener("change", sync);
      else query.addListener(sync);
    });

    return () => {
      mediaQueries.forEach((query) => {
        if (typeof query.removeEventListener === "function") query.removeEventListener("change", sync);
        else query.removeListener(sync);
      });
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-motion", motionMode);
  }, [motionMode]);

  return motionMode;
}
