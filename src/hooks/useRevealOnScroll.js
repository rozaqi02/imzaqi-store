import { useEffect } from "react";

// Adds subtle, high-quality reveal animations when elements scroll into view.
// Usage: call once near the top of the app (Layout) and add className="reveal".
// Pass a dependency (e.g. pathname) so the observer re-attaches on client-side route changes.
export function useRevealOnScroll(dep) {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const prefersReduced =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarsePointer =
      window.matchMedia &&
      (window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(max-width: 720px)").matches);
    const saveData = Boolean(navigator.connection && navigator.connection.saveData);
    const lowMemory = typeof navigator.deviceMemory === "number" && navigator.deviceMemory <= 4;

    if (prefersReduced || coarsePointer || saveData || lowMemory) {
      // Keep mobile and constrained devices responsive by skipping intersection work.
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
