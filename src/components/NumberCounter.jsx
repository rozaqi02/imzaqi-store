import React, { useEffect, useRef, useState } from "react";

/**
 * Animates a number from 0 to `value` when scrolled into view.
 * Skips animation under prefers-reduced-motion.
 */
export default function NumberCounter({ value, duration = 1100, format }) {
  const ref = useRef(null);
  const [display, setDisplay] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (value == null) return undefined;
    const target = Number(value);
    if (!Number.isFinite(target)) return undefined;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      setDisplay(target);
      setDone(true);
      return undefined;
    }

    const el = ref.current;
    if (!el || done) {
      setDisplay(target);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        const start = performance.now();
        let frame = 0;
        const step = (now) => {
          const t = Math.min(1, (now - start) / duration);
          // easeOutCubic
          const eased = 1 - Math.pow(1 - t, 3);
          setDisplay(Math.round(target * eased));
          if (t < 1) {
            frame = requestAnimationFrame(step);
          } else {
            setDone(true);
          }
        };
        frame = requestAnimationFrame(step);
        observer.disconnect();
        return () => cancelAnimationFrame(frame);
      },
      { threshold: 0.4 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [value, duration, done]);

  const formatted = typeof format === "function" ? format(display) : Number(display).toLocaleString("id-ID");

  return (
    <span ref={ref}>
      {formatted}
    </span>
  );
}
