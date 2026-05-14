import { useEffect } from "react";

/**
 * Mounts global, lightweight DOM listeners for visual polish:
 *  - image fade-in on load (data-loaded attr)
 *  - spotlight cursor follower (--cursor-x / --cursor-y on body)
 *  - card mouse-tracking (--mx / --my on .product-tile, .catalog-card, .pdx-variantCard)
 *
 * All handlers are throttled via requestAnimationFrame and disabled
 * automatically on coarse pointer / reduced motion.
 */
export default function PolishEffects() {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia?.("(pointer: coarse), (max-width: 920px)").matches;

    // ── Image fade-in: mark images as loaded so CSS can fade them in ──
    const handleImg = (img) => {
      if (img.complete) {
        img.dataset.loaded = "true";
      } else {
        const onLoad = () => {
          img.dataset.loaded = "true";
        };
        img.addEventListener("load", onLoad, { once: true });
        img.addEventListener("error", onLoad, { once: true });
      }
    };

    document.querySelectorAll("img").forEach(handleImg);

    const imgObserver = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        m.addedNodes.forEach((n) => {
          if (n.nodeType !== 1) return;
          if (n.tagName === "IMG") handleImg(n);
          n.querySelectorAll?.("img").forEach(handleImg);
        });
      });
    });
    imgObserver.observe(document.body, { childList: true, subtree: true });

    if (reduce || coarse) {
      return () => imgObserver.disconnect();
    }

    // ── Spotlight cursor follower (desktop only) ──
    let frame = 0;
    const onMouseMove = (e) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        document.body.style.setProperty("--cursor-x", `${e.clientX}px`);
        document.body.style.setProperty("--cursor-y", `${e.clientY}px`);
      });
    };
    window.addEventListener("mousemove", onMouseMove, { passive: true });

    // ── Card mouse tracking for radial glow ──
    const cardSelector = ".product-tile, .catalog-card, .pdx-variantCard";
    const onCardMove = (e) => {
      const card = e.target.closest(cardSelector);
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      card.style.setProperty("--mx", `${x}%`);
      card.style.setProperty("--my", `${y}%`);
    };
    document.addEventListener("mousemove", onCardMove, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mousemove", onCardMove);
      imgObserver.disconnect();
    };
  }, []);

  return null;
}
