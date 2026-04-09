import { useEffect } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable='true']",
].join(",");

let appInertLocks = 0;

function setAppInert(active) {
  if (typeof document === "undefined") return;
  const root = document.getElementById("root");
  if (!root) return;

  if (active) {
    appInertLocks += 1;
    if (appInertLocks > 1) return;

    root.setAttribute("aria-hidden", "true");
    try {
      root.inert = true;
    } catch {}
    return;
  }

  appInertLocks = Math.max(0, appInertLocks - 1);
  if (appInertLocks > 0) return;

  root.removeAttribute("aria-hidden");
  try {
    root.inert = false;
  } catch {}
}

function isFocusable(element) {
  if (!(element instanceof HTMLElement)) return false;
  if (element.hasAttribute("disabled")) return false;
  if (element.getAttribute("aria-hidden") === "true") return false;
  if (element.tabIndex < 0) return false;
  return element.offsetParent !== null || element.getClientRects().length > 0;
}

function getFocusableElements(container) {
  if (!(container instanceof HTMLElement)) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(isFocusable);
}

export function useDialogA11y({ open, containerRef, onClose, initialFocusSelector }) {
  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;

    const container = containerRef?.current;
    if (!(container instanceof HTMLElement)) return undefined;

    setAppInert(true);
    container.setAttribute("tabindex", "-1");

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusInitial = () => {
      const target =
        (initialFocusSelector && container.querySelector(initialFocusSelector)) ||
        getFocusableElements(container)[0] ||
        container;
      if (target instanceof HTMLElement) target.focus({ preventScroll: true });
    };

    const raf = window.requestAnimationFrame(focusInitial);

    const onKeyDownInternal = (event) => {
      if (!open) return;

      if (event.key === "Escape") {
        if (typeof onClose === "function") {
          event.preventDefault();
          onClose();
        }
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = getFocusableElements(container);
      if (focusable.length === 0) {
        event.preventDefault();
        container.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (!container.contains(active)) {
        event.preventDefault();
        first.focus({ preventScroll: true });
        return;
      }

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    window.addEventListener("keydown", onKeyDownInternal, true);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDownInternal, true);
      setAppInert(false);
      if (previousFocus && typeof previousFocus.focus === "function") {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [containerRef, initialFocusSelector, onClose, open]);
}
