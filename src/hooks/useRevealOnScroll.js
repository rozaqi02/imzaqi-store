import { useEffect } from "react";

// Adds subtle, high-quality reveal animations when elements scroll into view.
// Usage: call once near the top of the app (Layout) and add className="reveal".
// Pass a dependency (e.g. pathname) so the observer re-attaches on client-side route changes.
export function useRevealOnScroll(dep) {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const prefersReduced =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      // Ensure reveal elements are visible without animation.
      document.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-visible"));
      return undefined;
    }

    const els = Array.from(document.querySelectorAll(".reveal"));
    if (!els.length) return undefined;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        }
      },
      {
        root: null,
        threshold: 0.12,
        rootMargin: "0px 0px -10% 0px",
      }
    );

    els.forEach((el) => io.observe(el));

    return () => {
      try {
        io.disconnect();
      } catch (_) {
        // noop
      }
    };
  }, [dep]);
}
