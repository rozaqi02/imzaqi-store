import React, { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
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
import AbandonedCartBanner from "./components/AbandonedCartBanner";
import SwUpdateToast from "./components/SwUpdateToast";
import PageErrorBoundary from "./components/PageErrorBoundary";
import { shouldSkipCatalogScrollToTop } from "./hooks/useScrollMemory";
import { getOrderHistory } from "./lib/orderHistory";
import { captureReferralFromUrl } from "./lib/referral";
import { useFunnelRoute } from "./hooks/useFunnelRoute";
import CartSheetPortal from "./components/CartSheetPortal";

// ── Eager-loaded pages (critical path) ──
import Home from "./pages/Home";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";

// ── Lazy-loaded pages (non-critical, reduces initial bundle) ──
const Status = React.lazy(() => import("./pages/Status"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const About = React.lazy(() => import("./pages/About"));
const Faq = React.lazy(() => import("./pages/Faq"));
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
  const isFunnel = useFunnelRoute();
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

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const active = Boolean(order && !dismissed);
    document.body.classList.toggle("has-floating-order", active);
    return () => document.body.classList.remove("has-floating-order");
  }, [order, dismissed]);

  if (isFunnel || !order || dismissed) return null;

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
  const isFunnel = useFunnelRoute();
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

  if (isFunnel) return null;

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

function ReferralCapture() {
  const location = useLocation();

  useEffect(() => {
    captureReferralFromUrl(location.search);
  }, [location.search]);

  return null;
}

function BoundedRoute({ pageName, children }) {
  return <PageErrorBoundary pageName={pageName}>{children}</PageErrorBoundary>;
}

function ScrollToTop() {
  const location = useLocation();
  const displayLocation = location.state?.backgroundLocation || location;
  const pathname = displayLocation.pathname;
  const prevPathRef = useRef(pathname);

  useLayoutEffect(() => {
    const prevPath = prevPathRef.current;
    prevPathRef.current = pathname;

    if (pathname === "/produk") {
      // URL filter sync can re-run this effect — never scroll-to-top for that.
      if (prevPath === "/produk") return;
      if (shouldSkipCatalogScrollToTop()) return;
    }

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(max-width: 920px), (pointer: coarse)").matches;
    window.scrollTo({ top: 0, behavior: reduce || coarse ? "auto" : "smooth" });
  }, [pathname, location.key]);

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
          <Route path="/" element={<BoundedRoute pageName="Home"><Home /></BoundedRoute>} />
          <Route path="/produk/:slug" element={<BoundedRoute pageName="Detail Produk"><ProductDetail /></BoundedRoute>} />
          <Route path="/produk" element={<BoundedRoute pageName="Katalog"><Products /></BoundedRoute>} />
          <Route path="/tentang" element={<BoundedRoute pageName="Tentang"><About /></BoundedRoute>} />
          <Route path="/faq" element={<BoundedRoute pageName="FAQ"><Faq /></BoundedRoute>} />
          <Route path="/testimoni" element={<BoundedRoute pageName="Testimoni"><Testimonials /></BoundedRoute>} />
          <Route path="/checkout" element={<BoundedRoute pageName="Checkout"><Checkout /></BoundedRoute>} />
          <Route path="/bayar" element={<BoundedRoute pageName="Bayar"><Pay /></BoundedRoute>} />
          <Route path="/status" element={<BoundedRoute pageName="Status Order"><Status /></BoundedRoute>} />
          <Route path="/riwayat" element={<Navigate to="/status?tab=riwayat" replace />} />
          <Route path="/admin" element={<BoundedRoute pageName="Admin Login"><AdminLogin /></BoundedRoute>} />
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute>
                <BoundedRoute pageName="Admin Dashboard">
                  <AdminDashboard />
                </BoundedRoute>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<BoundedRoute pageName="404"><NotFound /></BoundedRoute>} />
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
      <CartSheetPortal />
      <ReferralCapture />
      <NetworkBridge />
      <PolishEffects />
      <Confetti />
      <AchievementToast />
      <AssistantBubble />
      <FlashSalePopup />
      <AbandonedCartBanner />
      <SwUpdateToast />
      <ScrollToTop />
      <RouteProgress />
      <FloatingOrderStatus />
      <ScrollToTopButton />
      <AppRoutes />
    </BrowserRouter>
  );
}
