import { useEffect, useRef } from "react";

/**
 * Lightweight 3D tilt effect on hover (desktop only).
 * Auto-disables on coarse pointer / reduced motion.
 *
 * Usage: <div ref={useTilt()}>...</div>
 */
export function useTilt({ max = 8, scale = 1.01 } = {}) {
  const ref = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia?.("(pointer: coarse), (max-width: 920px)").matches;
    if (reduce || coarse) return undefined;

    const el = ref.current;
    if (!el) return undefined;

    let frame = 0;
    let active = false;

    const onEnter = () => {
      active = true;
      el.style.transition = "transform 0.18s var(--ease-out, cubic-bezier(0.22,1,0.36,1))";
    };

    const onMove = (e) => {
      if (!active) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        const rx = (0.5 - y) * max;
        const ry = (x - 0.5) * max;
        el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${scale})`;
      });
    };

    const onLeave = () => {
      active = false;
      cancelAnimationFrame(frame);
      el.style.transition = "transform 0.32s var(--ease-out, cubic-bezier(0.22,1,0.36,1))";
      el.style.transform = "";
    };

    el.addEventListener("mouseenter", onEnter);
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);

    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("mouseenter", onEnter);
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [max, scale]);

  return ref;
}
