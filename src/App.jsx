import React, { Suspense, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Layout from "./components/Layout";
import RouteProgress from "./components/RouteProgress";
import ProtectedRoute from "./components/ProtectedRoute";
import NetworkBridge from "./components/NetworkBridge";
import PolishEffects from "./components/PolishEffects";
import Confetti from "./components/Confetti";
import AssistantBubble from "./components/AssistantBubble";
import { usePageView } from "./hooks/usePageView";
import { useGlobalShortcuts } from "./hooks/useGlobalShortcuts";
import { useLongTaskMonitor } from "./hooks/usePerformanceMonitor";
import { useDeviceCapability } from "./hooks/useIsMobile";
import { rafThrottle } from "./utils/throttle";
import { ChevronUp } from "lucide-react";
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

// ── Branded page loading fallback ──
function PageLoader() {
  return (
    <div className="page-loader" aria-label="Memuat halaman" role="status">
      <div className="page-loader-inner">
        <img className="page-loader-logo" src="/icon.png" alt="imzaqi.store" />
        <div className="page-loader-dots">
          <span />
          <span />
          <span />
        </div>
      </div>
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
      <AssistantBubble />
      <ScrollToTop />
      <RouteProgress />
      <ScrollToTopButton />
      <AppRoutes />
    </BrowserRouter>
  );
}
