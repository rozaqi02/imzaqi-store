import { useLayoutEffect } from "react";

// Adds subtle reveal animations when elements scroll into view.
// Automatically tracks new elements using MutationObserver so no race conditions occur.
const REVEAL_SELECTOR = ".reveal, .reveal-left, .reveal-scale, .reveal-blur";

function markInViewportReveals() {
  const viewportBottom = window.innerHeight * 0.88;
  document.querySelectorAll(`${REVEAL_SELECTOR}:not(.is-visible)`).forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.top < viewportBottom && rect.bottom > 0) {
      el.classList.add("is-visible");
    }
  });
}

function enableRevealAnimations() {
  markInViewportReveals();
  document.documentElement.classList.add("js-ready");
}

function markUtilityPageReveals() {
  document
    .querySelectorAll(
      ".status-shell.reveal, .faq-shell .reveal, .catalog-hero.reveal, .page > .section.reveal, .page > .reveal"
    )
    .forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        el.classList.add("is-visible");
      }
    });
}

export function useRevealOnScroll(dependency) {
  useLayoutEffect(() => {
    if (typeof window === "undefined") return undefined;

    const prefersReduced =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = Boolean(navigator.connection && navigator.connection.saveData);
    const lowMemory = typeof navigator.deviceMemory === "number" && navigator.deviceMemory <= 2;

    if (prefersReduced || saveData || lowMemory) {
      // Respect accessibility and performance constraints by making all elements visible immediately.
      document.querySelectorAll(`${REVEAL_SELECTOR}:not(.is-visible)`).forEach((el) =>
        el.classList.add("is-visible")
      );
      enableRevealAnimations();
      return undefined;
    }

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
        threshold: 0,
        rootMargin: "0px 0px 12% 0px",
      }
    );

    // Keep track of observed elements using a class to prevent duplicate observations
    const observeNewElements = () => {
      const els = document.querySelectorAll(`${REVEAL_SELECTOR}:not(.is-observed)`);
      els.forEach((el) => {
        el.classList.add("is-observed");
        io.observe(el);
      });
      markInViewportReveals();
    };

    // Run before paint so utility pages (FAQ/Status) never flash blank.
    markUtilityPageReveals();
    observeNewElements();
    enableRevealAnimations();

    // Monitor the DOM to automatically detect and observe dynamically rendered elements
    // Throttled via requestAnimationFrame to avoid triggering layout/style recalculation storms
    let frame = null;
    const observer = new MutationObserver(() => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        observeNewElements();
        frame = null;
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      io.disconnect();
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [dependency]);
}


