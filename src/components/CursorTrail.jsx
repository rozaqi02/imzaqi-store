import { useEffect, useRef } from "react";

const DOT_SIZE = 8;
const FADE_DURATION = 520;
const THROTTLE_MS = 30;
const MAX_DOTS = 60;

export default function CursorTrail() {
  const dotsRef = useRef([]);
  const timerRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia?.("(pointer: coarse), (max-width: 920px)").matches;
    if (reduce || coarse) return;

    const container = document.createElement("div");
    container.className = "cursor-trail-container";
    container.setAttribute("aria-hidden", "true");
    document.body.appendChild(container);

    let lastMove = 0;

    function onMove(e) {
      const now = Date.now();
      if (now - lastMove < THROTTLE_MS) return;
      lastMove = now;

      const dot = document.createElement("span");
      dot.className = "cursor-trail-dot";
      dot.style.left = `${e.clientX - DOT_SIZE / 2}px`;
      dot.style.top = `${e.clientY - DOT_SIZE / 2}px`;
      container.appendChild(dot);

      dotsRef.current.push(dot);
      if (dotsRef.current.length > MAX_DOTS) {
        const old = dotsRef.current.shift();
        old?.remove();
      }

      rafRef.current = requestAnimationFrame(() => {
        dot.style.opacity = "0";
        dot.style.transform = `scale(0.2)`;
      });

      timerRef.current = setTimeout(() => {
        dot.remove();
        const idx = dotsRef.current.indexOf(dot);
        if (idx >= 0) dotsRef.current.splice(idx, 1);
      }, FADE_DURATION);
    }

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      clearTimeout(timerRef.current);
      cancelAnimationFrame(rafRef.current);
      container.remove();
    };
  }, []);

  return null;
}
