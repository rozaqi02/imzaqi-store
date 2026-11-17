import { flushSync } from "react-dom";

let activeTransitionProductSlug = "";

export function setTransitionProductSlug(slug) {
  activeTransitionProductSlug = String(slug || "").trim();
}

export function getTransitionProductSlug() {
  return activeTransitionProductSlug;
}

export function clearTransitionProductSlug() {
  activeTransitionProductSlug = "";
}

export function canUseViewTransitions() {
  if (typeof document === "undefined" || typeof document.startViewTransition !== "function") {
    return false;
  }
  if (document.documentElement?.dataset?.motion === "off") {
    return false;
  }
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
    return false;
  }
  return true;
}

export function runViewTransition(callback, { slug } = {}) {
  if (slug) setTransitionProductSlug(slug);
  if (typeof callback !== "function") return;
  if (!canUseViewTransitions()) {
    callback();
    return;
  }

  try {
    const transition = document.startViewTransition(() => {
      flushSync(callback);
    });
    if (transition?.finished) {
      transition.finished.finally(() => {
        // Keep slug briefly during mount if lazy-loaded, then clear cleanly on next frame cycle
        window.setTimeout(() => {
          if (activeTransitionProductSlug === slug) {
            activeTransitionProductSlug = "";
          }
        }, 420);
      });
    }
  } catch {
    callback();
  }
}

export function handleViewTransitionLinkClick(
  event,
  navigate,
  to,
  { slug, state, iconSelector, titleSelector } = {}
) {
  if (slug) setTransitionProductSlug(slug);
  if (
    !event ||
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    !canUseViewTransitions() ||
    typeof navigate !== "function"
  ) {
    return;
  }

  const hostEl = event.currentTarget;
  const iconEl = slug && iconSelector && hostEl?.querySelector ? hostEl.querySelector(iconSelector) : null;
  const titleEl = slug && titleSelector && hostEl?.querySelector ? hostEl.querySelector(titleSelector) : null;

  if (iconEl) iconEl.style.viewTransitionName = `product-icon-${slug}`;
  if (titleEl) titleEl.style.viewTransitionName = `product-title-${slug}`;

  event.preventDefault();
  runViewTransition(() => navigate(to, state ? { state } : undefined), { slug });

  window.setTimeout(() => {
    if (iconEl) iconEl.style.viewTransitionName = "";
    if (titleEl) titleEl.style.viewTransitionName = "";
  }, 420);
}
