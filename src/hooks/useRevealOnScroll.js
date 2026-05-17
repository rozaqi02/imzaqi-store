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

    let raf1, raf2;

    function attach() {
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
          // Positive bottom margin: elements near the bottom of viewport still trigger.
          // This prevents the race condition on refresh where the page hasn't fully
          // painted yet when the observer first fires.
          threshold: 0,
          rootMargin: "0px 0px 20% 0px",
        }
      );

      els.forEach((el) => io.observe(el));
      return io;
    }

    let io;

    // Double rAF: wait for browser to finish layout + paint before attaching observer.
    // This fixes the blank-on-refresh issue on desktop where .reveal elements are
    // already in the viewport but the observer fires before layout is complete.
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        io = attach();
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      try {
        io?.disconnect();
      } catch (_) {
        // noop
      }
    };
  }, [dep]);
}
