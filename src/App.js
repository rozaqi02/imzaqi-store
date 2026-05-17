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
import { ChevronUp } from "lucide-react";

// ── Eager-loaded pages (critical path) ──
import Home from "./pages/Home";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import Status from "./pages/Status";
import NotFound from "./pages/NotFound";

// ── Lazy-loaded pages (non-critical, reduces initial bundle) ──
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
    let ticking = false;

    function onScroll() {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setVisible(window.scrollY > 400);
          ticking = false;
        });
        ticking = true;
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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
  const backgroundLocation = location.state?.backgroundLocation;
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
