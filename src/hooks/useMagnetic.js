import { useEffect, useRef } from "react";

export function useMagnetic({ strength = 18, radius = 80 } = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const coarse = window.matchMedia?.("(pointer: coarse), (max-width: 920px)")?.matches;
    const motionMode = typeof document !== "undefined" ? document.documentElement.getAttribute("data-motion") : "full";
    if (prefersReduced || coarse || motionMode === "off") return;

    const onMouseMove = (e) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const distance = Math.hypot(dx, dy);

      if (distance < radius) {
        const factor = (radius - distance) / radius;
        const tx = (dx / distance) * factor * strength;
        const ty = (dy / distance) * factor * strength;
        el.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
      } else {
        el.style.transform = "";
      }
    };

    const onMouseLeave = () => {
      el.style.transform = "";
    };

    window.addEventListener("mousemove", onMouseMove);
    el.addEventListener("mouseleave", onMouseLeave);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      if (el) el.removeEventListener("mouseleave", onMouseLeave);
    };
  }, [strength, radius]);

  return ref;
}
