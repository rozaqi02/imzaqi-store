import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export function useGlobalShortcuts() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    function onKeyDown(e) {
      // Skip if user is typing in input/textarea/contenteditable
      const target = e.target;
      const tag = (target?.tagName || "").toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || target?.isContentEditable;

      // "/" → focus first search input on page (skip if already typing)
      if (e.key === "/" && !isTyping && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const searchInput = document.querySelector(
          'input[type="search"], input[name="search"], input[placeholder*="Cari" i], .hero-search-input, .catalog-commandInput, .faq-searchInput, .testi-searchInput, .admin-searchInput'
        );
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
          searchInput.select?.();
        }
      }

      // "g h" → home, "g p" → produk, "g s" → status, "g r" → riwayat
      // Simple two-key sequence: track last "g" press
      if (e.key === "g" && !isTyping && !e.metaKey && !e.ctrlKey) {
        window.__lastGKey = Date.now();
        return;
      }

      const lastG = window.__lastGKey || 0;
      if (Date.now() - lastG < 800 && !isTyping) {
        const map = { h: "/", p: "/produk", s: "/status", r: "/riwayat", f: "/tentang" };
        if (map[e.key]) {
          e.preventDefault();
          navigate(map[e.key]);
          window.__lastGKey = 0;
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate, location.pathname]);
}
