import { useEffect } from "react";

// Adds subtle reveal animations when elements scroll into view.
// Pass a dependency (e.g. pathname) so the observer re-attaches on route changes.
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
      // On mobile/constrained devices: skip intersection work, show everything immediately.
      document.querySelectorAll(".reveal:not(.is-visible)").forEach((el) =>
        el.classList.add("is-visible")
      );
      return undefined;
    }

    // Only observe elements that are NOT yet visible — avoids re-animating
    // elements that were already revealed on a previous route visit.
    const els = Array.from(document.querySelectorAll(".reveal:not(.is-visible)"));
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
        threshold: 0.1,
        rootMargin: "0px 0px -8% 0px",
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
