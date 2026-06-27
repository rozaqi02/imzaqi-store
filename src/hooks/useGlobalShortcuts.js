import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";

// ── Page Title Ticker (tab blur) ─────────────────────────────────────────
const TICKER_MSGS = [
  "Balik sini~ 👋",
  "Masih ada yang nunggu 👀",
  "Jangan lama-lama 😅",
  "Stok terbatas nih!",
];

export function useTitleTicker() {
  const originalTitle = useRef(document.title);
  const intervalRef = useRef(null);
  const idxRef = useRef(0);

  useEffect(() => {
    function onBlur() {
      originalTitle.current = document.title;
      idxRef.current = 0;
      intervalRef.current = setInterval(() => {
        document.title = TICKER_MSGS[idxRef.current % TICKER_MSGS.length];
        idxRef.current++;
        // Restore original title every full cycle
        if (idxRef.current % TICKER_MSGS.length === 0) {
          clearInterval(intervalRef.current);
          document.title = originalTitle.current;
        }
      }, 2000);
    }

    function onFocus() {
      clearInterval(intervalRef.current);
      document.title = originalTitle.current;
    }

    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(intervalRef.current);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.title = originalTitle.current;
    };
  }, []);
}

const KONAMI = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"];

function triggerKonamiEgg() {
  // Create overlay
  const overlay = document.createElement("div");
  overlay.style.cssText = [
    "position:fixed","inset:0","z-index:99999","display:flex",
    "flex-direction:column","align-items:center","justify-content:center",
    "background:rgba(0,0,0,0.82)","backdrop-filter:blur(8px)",
    "cursor:pointer","animation:konami-in 0.4s cubic-bezier(0.22,1,0.36,1)"
  ].join(";");

  const emojis = ["🎮","🕹️","🎯","🏆","💎","🚀","⭐","🎊"];
  const messages = [
    "CHEAT CODE ACTIVATED!",
    "Kamu nemu easter egg! 🥚",
    "Secret unlocked!",
    "Developer mode: ON 😎",
  ];
  const msg = messages[Math.floor(Math.random() * messages.length)];
  const emoji = emojis[Math.floor(Math.random() * emojis.length)];

  overlay.innerHTML = `
    <div style="text-align:center;padding:32px;">
      <div style="font-size:80px;margin-bottom:16px;animation:konami-bounce 0.6s ease infinite alternate">${emoji}</div>
      <div style="font-size:28px;font-weight:800;color:#00d6b4;margin-bottom:8px;letter-spacing:-0.5px">${msg}</div>
      <div style="font-size:15px;color:rgba(255,255,255,0.7);margin-bottom:24px">↑↑↓↓←→←→BA — Konami Code</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.4)">Klik di mana saja untuk tutup</div>
    </div>
  `;

  if (!document.getElementById("konami-style")) {
    const style = document.createElement("style");
    style.id = "konami-style";
    style.textContent = `
      @keyframes konami-in { from { opacity:0; transform:scale(0.8); } to { opacity:1; transform:scale(1); } }
      @keyframes konami-bounce { from { transform:scale(1) rotate(-5deg); } to { transform:scale(1.15) rotate(5deg); } }
    `;
    document.head.appendChild(style);
  }

  overlay.addEventListener("click", () => overlay.remove());
  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 6000);

  // Also fire confetti if available
  try { window.dispatchEvent(new CustomEvent("imzaqi:confetti")); } catch {}
}

export function useGlobalShortcuts() {
  const navigate = useNavigate();
  const location = useLocation();
  const konamiRef = useRef([]);

  useEffect(() => {
    function onKeyDown(e) {
      // Konami Code detection
      konamiRef.current.push(e.key);
      if (konamiRef.current.length > KONAMI.length) {
        konamiRef.current.shift();
      }
      if (konamiRef.current.join(",") === KONAMI.join(",")) {
        konamiRef.current = [];
        triggerKonamiEgg();
        return;
      }
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
