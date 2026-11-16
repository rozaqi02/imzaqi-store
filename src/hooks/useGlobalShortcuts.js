import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export function useTitleTicker() {
  // Title stays stable; avoids annoying title flashing on tab blur.
}

const KONAMI = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"];

function triggerKonamiEgg() {
  const overlay = document.createElement("div");
  overlay.style.cssText = [
    "position:fixed","inset:0","z-index:99999","display:flex",
    "flex-direction:column","align-items:center","justify-content:center",
    "background:rgba(0,0,0,0.85)","backdrop-filter:blur(10px)",
    "cursor:pointer","animation:konami-in 0.3s ease-out"
  ].join(";");

  overlay.innerHTML = `
    <div style="text-align:center;padding:24px 32px;background:#11151c;border:1px solid rgba(255,255,255,0.12);border-radius:16px;max-width:380px;">
      <div style="font-size:18px;font-weight:700;color:#00d6b4;margin-bottom:6px;letter-spacing:-0.2px">Konami Code Activated</div>
      <div style="font-size:14px;color:rgba(255,255,255,0.7);margin-bottom:16px">Mode pengembang dan penyesuaian pintasan aktif.</div>
      <div style="font-size:12px;color:rgba(255,255,255,0.4)">Klik untuk menutup</div>
    </div>
  `;

  if (!document.getElementById("konami-style")) {
    const style = document.createElement("style");
    style.id = "konami-style";
    style.textContent = `
      @keyframes konami-in { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }
    `;
    document.head.appendChild(style);
  }

  overlay.addEventListener("click", () => overlay.remove());
  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 4000);

  try { window.dispatchEvent(new CustomEvent("imzaqi:confetti")); } catch {}
}

export function useGlobalShortcuts() {
  const navigate = useNavigate();
  const location = useLocation();
  const konamiRef = useRef([]);

  useEffect(() => {
    function onKeyDown(e) {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      const isInput = ["input", "textarea", "select"].includes(activeTag) ||
        document.activeElement?.isContentEditable;

      // Konami tracker (works anywhere)
      konamiRef.current.push(e.key);
      if (konamiRef.current.length > KONAMI.length) {
        konamiRef.current.shift();
      }
      if (konamiRef.current.join(",") === KONAMI.join(",")) {
        triggerKonamiEgg();
        konamiRef.current = [];
        return;
      }

      // Ignore standard hotkeys inside text inputs
      if (isInput) return;

      // Escape -> close any open dialog or modal
      if (e.key === "Escape") {
        const closeBtn = document.querySelector(
          "[data-close-modal], .modal-close, .dialog-close, [aria-label='Close'], [aria-label='Tutup']"
        );
        if (closeBtn) {
          closeBtn.click();
          e.preventDefault();
        }
        return;
      }

      // '/' -> Focus search input
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        const searchInput = document.querySelector(
          "input[type='search'], input[placeholder*='Cari'], input[placeholder*='cari'], .catalog-search-input"
        );
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
          searchInput.select?.();
        }
        return;
      }

      // '?' -> Toggle hotkey cheat sheet
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("imzaqi:toggle-shortcuts"));
        return;
      }

      // 'g' then 'h' -> Go home
      // 'g' then 'c' -> Go checkout
      // 'g' then 's' -> Go status
      // Handled via sequence state if needed
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate, location]);
}
