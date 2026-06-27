import React, { Suspense, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Layout from "./components/Layout";
import RouteProgress from "./components/RouteProgress";
import ProtectedRoute from "./components/ProtectedRoute";
import NetworkBridge from "./components/NetworkBridge";
import PolishEffects from "./components/PolishEffects";
import Confetti from "./components/Confetti";
import AssistantBubble from "./components/AssistantBubble";
import FlashSalePopup from "./components/FlashSalePopup";
import { usePageView } from "./hooks/usePageView";
import { useGlobalShortcuts, useTitleTicker } from "./hooks/useGlobalShortcuts";
import { useLongTaskMonitor } from "./hooks/usePerformanceMonitor";
import { useDeviceCapability } from "./hooks/useIsMobile";
import { rafThrottle } from "./utils/throttle";
import { ArrowRight, ChevronUp, X } from "lucide-react";
import AchievementToast from "./components/AchievementToast";
import { hasSavedScrollY } from "./hooks/useScrollMemory";

// ── Eager-loaded pages (critical path) ──
import Home from "./pages/Home";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";

// ── Lazy-loaded pages (non-critical, reduces initial bundle) ──
const Status = React.lazy(() => import("./pages/Status"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const About = React.lazy(() => import("./pages/About"));
const Testimonials = React.lazy(() => import("./pages/Testimonials"));
const Checkout = React.lazy(() => import("./pages/Checkout"));
const Pay = React.lazy(() => import("./pages/Pay"));
const AdminLogin = React.lazy(() => import("./pages/admin/AdminLogin"));
const AdminDashboard = React.lazy(() => import("./pages/admin/AdminDashboard"));

const LOADER_QUOTES = [
  "Nyiapin yang terbaik buat kamu...",
  "Stok fresh, harga pelajar 💎",
  "Sebentar ya, lagi ngambil dari gudang...",
  "Premium terjangkau, bukan mimpi ✨",
  "Muat sebentar, worth the wait!",
  "Loading... tapi cepet kok 😄",
  "Akun ready, tinggal checkout 🚀",
];

// ── Branded page loading fallback ──
function PageLoader() {
  const [text, setText] = React.useState("");
  const [quoteIdx] = React.useState(() => Math.floor(Math.random() * LOADER_QUOTES.length));
  const quote = LOADER_QUOTES[quoteIdx];
  const charRef = React.useRef(0);

  React.useEffect(() => {
    charRef.current = 0;
    setText("");
    const interval = setInterval(() => {
      charRef.current += 1;
      setText(quote.slice(0, charRef.current));
      if (charRef.current >= quote.length) clearInterval(interval);
    }, 38);
    return () => clearInterval(interval);
  }, [quote]);

  return (
    <div className="page-loader" aria-label="Memuat halaman" role="status">
      <div className="page-loader-inner">
        <img className="page-loader-logo" src="/icon.png" alt="imzaqi.store" />
        <div className="page-loader-dots">
          <span />
          <span />
          <span />
        </div>
        <p className="page-loader-quote" aria-live="polite">{text}<span className="page-loader-cursor" aria-hidden="true">|</span></p>
      </div>
    </div>
  );
}

// ── Floating recent order button ──
function FloatingOrderStatus() {
  const [order, setOrder] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const history = getOrderHistory();
      if (history.length > 0 && history[0]?.order_code) {
        const last = history[0];
        const age = Date.now() - new Date(last.created_at).getTime();
        if (age < 86400000) setOrder(last);
      }
    } catch {}
  }, []);

  if (!order || dismissed) return null;

  return (
    <div className="floating-order-status">
      <button
        className="floating-order-btn"
        type="button"
        onClick={() => {
          window.location.href = `/status?order=${encodeURIComponent(order.order_code)}`;
        }}
      >
        <span className="floating-order-dot" />
        <span className="floating-order-code">{order.order_code}</span>
        <ArrowRight size={14} />
      </button>
      <button
        className="floating-order-dismiss"
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Tutup"
      >
        <X size={12} />
      </button>
    </div>
  );
}

// ── Scroll-to-top floating button ──
function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const throttledScroll = rafThrottle(() => {
      setVisible(window.scrollY > 400);
    });

    window.addEventListener("scroll", throttledScroll, { passive: true });
    return () => {
      throttledScroll.cancel();
      window.removeEventListener("scroll", throttledScroll);
    };
  }, []);

  function scrollUp() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <button
      type="button"
      className={`scroll-to-top${visible ? " is-visible" : ""}`}
      onClick={scrollUp}
      aria-label="Kembali ke atas"
      title="Kembali ke atas"
    >
      <ChevronUp size={20} strokeWidth={2.4} />
    </button>
  );
}

// ── Smooth scroll to top on route change ──
function SuspenseReadyNotifier({ onReady, routeKey }) {
  React.useEffect(() => {
    // Double rAF ensures browser has painted before showing footer
    let id1 = requestAnimationFrame(() => {
      let id2 = requestAnimationFrame(() => onReady());
      return () => cancelAnimationFrame(id2);
    });
    return () => cancelAnimationFrame(id1);
  }, [routeKey]);
  return null;
}

function ScrollToTop() {
  const location = useLocation();
  const displayLocation = location.state?.backgroundLocation || location;
  const pathname = displayLocation.pathname;

  useEffect(() => {
    // When navigating back to /produk with saved scroll, let Products restore it
    if (pathname === "/produk" && hasSavedScrollY()) return;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(max-width: 920px), (pointer: coarse)").matches;
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: reduce || coarse ? "auto" : "smooth" });
    });
  }, [pathname]);

  return null;
}

function AppRoutes() {
  const location = useLocation();
  const backgroundLocation = location.state?.backgroundLocation || null;
  const displayLocation = backgroundLocation || location;

  usePageView();
  useGlobalShortcuts();

  return (
    <Layout routeKey={displayLocation.pathname}>
      <Suspense fallback={<PageLoader />}>
        <Routes location={displayLocation}>
          <Route path="/" element={<Home />} />
          <Route path="/produk/:slug" element={<ProductDetail />} />
          <Route path="/produk" element={<Products />} />
          <Route path="/tentang" element={<About />} />
          <Route path="/testimoni" element={<Testimonials />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/bayar" element={<Pay />} />
          <Route path="/status" element={<Status />} />
          <Route path="/riwayat" element={<Navigate to="/status?tab=riwayat" replace />} />
          <Route path="/admin" element={<AdminLogin />} />
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>

      {backgroundLocation ? (
        <Suspense fallback={null}>
          <Routes>
            <Route path="/checkout" element={<Checkout />} />
          </Routes>
        </Suspense>
      ) : null}
    </Layout>
  );
}

export default function App() {
  const caps = useDeviceCapability();
  useLongTaskMonitor();
  useTitleTicker();

  // Rage Click Detector
  useEffect(() => {
    if (typeof window === "undefined") return;
    const RAGE_SELECTOR = "button:disabled, button[disabled], .btn-disabled, [disabled]"
    const clicks = [];
    let toastShown = false;

    function handleRageClick(e) {
      const target = e.target.closest(RAGE_SELECTOR);
      if (!target) return;
      const now = Date.now();
      clicks.push(now);
      // Keep only clicks within last 2 seconds
      while (clicks.length > 0 && now - clicks[0] > 2000) clicks.shift();
      if (clicks.length >= 3 && !toastShown) {
        toastShown = true;
        // Show a fun toast via custom event (ToastContext not available here)
        const el = document.createElement("div");
        el.className = "rage-toast";
        el.setAttribute("role", "status");
        el.innerHTML = `<span class="rage-toast-char">😅</span><span>Sabar ya, lagi diproses...</span>`;
        document.body.appendChild(el);
        setTimeout(() => { el.remove(); toastShown = false; clicks.length = 0; }, 2800);
      }
    }

    document.addEventListener("click", handleRageClick, { passive: true });
    return () => document.removeEventListener("click", handleRageClick);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !navigator.vibrate) return;

    function handleGlobalClick(e) {
      const target = e.target.closest(
        "button, a, input, select, textarea, .btn, .btn-ghost, .pdx-variantCard, .hc-statCard, .ai-chip, .st-tab, .suggestion-item, .st-pasteBtn, .oh-cekBtn"
      );
      if (target) {
        try {
          navigator.vibrate(10);
        } catch (err) {
          // Ignore potential browser safety restrictions
        }
      }
    }

    document.addEventListener("click", handleGlobalClick, { passive: true });
    return () => document.removeEventListener("click", handleGlobalClick);
  }, []);

  return (
    <BrowserRouter>
      <NetworkBridge />
      <PolishEffects />
      <Confetti />
      <AchievementToast />
      <AssistantBubble />
      <FlashSalePopup />
      <ScrollToTop />
      <RouteProgress />
      <FloatingOrderStatus />
      <ScrollToTopButton />
      <AppRoutes />
    </BrowserRouter>
  );
}
