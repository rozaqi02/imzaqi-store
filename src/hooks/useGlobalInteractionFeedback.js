import { useEffect } from "react";

export const RAGE_CLICK_SELECTOR =
  "button:disabled, button[disabled], [role='button'][aria-disabled='true'], .btn-disabled";

const HAPTIC_SELECTOR =
  "button:not([disabled]), .btn:not(.btn-disabled), .pdx-variantCard, .hc-statCard, .ai-chip, .st-tab, .st-pasteBtn, .oh-cekBtn, [role='switch'], [role='tab']";

export function useGlobalInteractionFeedback() {
  // 1) Rage-click detector (khusus tombol nonaktif, tidak salah tangkap input disabled)
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return undefined;

    const clicks = [];
    let activeToast = null;
    let toastTimerId = null;

    function handleRageClick(e) {
      const target = e.target?.closest?.(RAGE_CLICK_SELECTOR);
      if (!target) return;

      const now = Date.now();
      clicks.push(now);
      while (clicks.length > 0 && now - clicks[0] > 2000) clicks.shift();

      if (clicks.length >= 3 && !activeToast) {
        const el = document.createElement("div");
        el.className = "rage-toast";
        el.setAttribute("role", "status");

        const text = document.createElement("span");
        text.textContent = "Sabar ya, lagi diproses...";

        el.appendChild(text);
        document.body.appendChild(el);
        activeToast = el;

        toastTimerId = window.setTimeout(() => {
          if (activeToast) {
            activeToast.remove();
            activeToast = null;
          }
          toastTimerId = null;
          clicks.length = 0;
        }, 2800);
      }
    }

    document.addEventListener("click", handleRageClick, { passive: true });
    return () => {
      document.removeEventListener("click", handleRageClick);
      if (toastTimerId !== null) window.clearTimeout(toastTimerId);
      if (activeToast) activeToast.remove();
    };
  }, []);

  // 2) Targeted haptic feedback pada kontrol interaktif utama
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined" || !navigator.vibrate) {
      return undefined;
    }

    let lastVibrate = 0;

    function handleInteractiveClick(e) {
      const target = e.target?.closest?.(HAPTIC_SELECTOR);
      if (!target) return;

      const now = Date.now();
      if (now - lastVibrate < 120) return;
      lastVibrate = now;
      try {
        navigator.vibrate(10);
      } catch {}
    }

    document.addEventListener("click", handleInteractiveClick, { passive: true });
    return () => document.removeEventListener("click", handleInteractiveClick);
  }, []);
}
