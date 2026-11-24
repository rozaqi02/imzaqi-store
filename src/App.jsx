import React, { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminLoader from "./components/AdminLoader";
import PageLoader from "./components/PageLoader";
import NetworkBridge from "./components/NetworkBridge";
import Confetti from "./components/Confetti";
import FloatingOrderStatus from "./components/FloatingOrderStatus";
import PageErrorBoundary from "./components/PageErrorBoundary";
import Home from "./pages/Home";
import { PresenceProvider } from "./context/PresenceContext";
import { usePageView } from "./hooks/usePageView";
import { useGlobalShortcuts } from "./hooks/useGlobalShortcuts";
import { useLongTaskMonitor } from "./hooks/usePerformanceMonitor";
import { useDeviceCapability } from "./hooks/useIsMobile";
import { useGlobalInteractionFeedback } from "./hooks/useGlobalInteractionFeedback";
import { shouldSkipCatalogScrollToTop } from "./hooks/useScrollMemory";
import { useStorefrontOverlayBlocked } from "./hooks/useFunnelRoute";
import { captureReferralFromUrl } from "./lib/referral";
import { lazyPage, prefetchPrimaryRoutes } from "./lib/routePrefetch";

// Lazy-loaded pages (non-critical, reduces initial bundle)
const Faq = lazyPage("faq");
const Products = lazyPage("products");
const ProductDetail = lazyPage("productDetail");
const Status = lazyPage("status");
const NotFound = lazyPage("notFound");
const About = lazyPage("about");
const Testimonials = lazyPage("testimonials");
const Promosi = lazyPage("promosi");
const Checkout = lazyPage("checkout");
const Pay = lazyPage("pay");
const AdminLogin = lazyPage("adminLogin");
const AdminDashboard = lazyPage("adminDashboard");

// Lazy-loaded storefront overlays & background toasts (keeps initial JS bundle lean)
const FlashSalePopup = React.lazy(() => import("./components/FlashSalePopup"));
const AcademicPopup = React.lazy(() => import("./components/AcademicPopup"));
const NewProductPopup = React.lazy(() => import("./components/NewProductPopup"));
const AchievementToast = React.lazy(() => import("./components/AchievementToast"));
const AbandonedCartBanner = React.lazy(() => import("./components/AbandonedCartBanner"));
const SwUpdateToast = React.lazy(() => import("./components/SwUpdateToast"));

const DEFER_OVERLAY_MS = 2000;

function useDeferredOverlayMount(delayMs = DEFER_OVERLAY_MS) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const mount = () => {
      if (!cancelled) setReady(true);
    };

    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(mount, { timeout: delayMs });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(idleId);
      };
    }

    const timerId = window.setTimeout(mount, delayMs);
    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, [delayMs]);

  return ready;
}

function StorefrontOverlays() {
  const blocked = useStorefrontOverlayBlocked();
  if (blocked) return null;
  return (
    <Suspense fallback={null}>
      <FlashSalePopup />
      <AcademicPopup />
      <NewProductPopup />
    </Suspense>
  );
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

export function buildRedirectTarget(to, currentSearch = "") {
  const incoming = String(currentSearch || "").replace(/^\?/, "");
  if (!incoming) return to;
  return to.includes("?") ? `${to}&${incoming}` : `${to}?${incoming}`;
}

function RedirectKeepingSearch({ to }) {
  const location = useLocation();
  return <Navigate to={buildRedirectTarget(to, location.search)} replace />;
}

export function useCheckoutOverlayLocation(location) {
  const isCheckout = location?.pathname === "/checkout";
  const rawBackground = isCheckout ? (location.state?.backgroundLocation || null) : null;
  const backgroundLocation =
    rawBackground && rawBackground.pathname !== "/checkout" ? rawBackground : null;
  const useOverlay = Boolean(backgroundLocation);
  return {
    displayLocation: useOverlay ? backgroundLocation : location,
    showCheckoutOverlay: useOverlay,
  };
}

function ScrollToTop() {
  const location = useLocation();
  const { displayLocation, showCheckoutOverlay } = useCheckoutOverlayLocation(location);
  const pathname = displayLocation.pathname;
  const prevPathRef = useRef(pathname);

  useLayoutEffect(() => {
    const prevPath = prevPathRef.current;
    if (prevPath === pathname) return;
    prevPathRef.current = pathname;

    if (showCheckoutOverlay) return;

    if (pathname === "/produk" && shouldSkipCatalogScrollToTop()) {
      return;
    }

    if (pathname !== "/produk" && typeof history !== "undefined") {
      history.scrollRestoration = "auto";
    }

    const jumpTop = () => {
      try {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      } catch {
        window.scrollTo(0, 0);
      }
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    };
    jumpTop();
    const rafId = requestAnimationFrame(jumpTop);
    return () => cancelAnimationFrame(rafId);
  }, [pathname, showCheckoutOverlay]);

  return null;
}

function AppRoutes() {
  const location = useLocation();
  const { displayLocation, showCheckoutOverlay } = useCheckoutOverlayLocation(location);

  usePageView();
  useGlobalShortcuts();

  return (
    <Layout routeKey={displayLocation.pathname}>
      <PageErrorBoundary>
        <Suspense fallback={displayLocation.pathname.startsWith("/admin") ? <AdminLoader /> : <PageLoader />}>
          <Routes location={displayLocation}>
            <Route path="/" element={<BoundedRoute pageName="Home"><Home /></BoundedRoute>} />
            <Route path="/produk/:slug" element={<BoundedRoute pageName="Detail Produk"><ProductDetail /></BoundedRoute>} />
            <Route path="/produk" element={<BoundedRoute pageName="Katalog"><Products /></BoundedRoute>} />
            <Route path="/tentang" element={<BoundedRoute pageName="Tentang"><About /></BoundedRoute>} />
            <Route path="/faq" element={<BoundedRoute pageName="Bantuan"><Faq /></BoundedRoute>} />
            <Route path="/testimoni" element={<BoundedRoute pageName="Ulasan"><Testimonials /></BoundedRoute>} />
            <Route path="/promosi" element={<BoundedRoute pageName="Media Promosi"><Promosi /></BoundedRoute>} />
            <Route path="/checkout" element={<BoundedRoute pageName="Checkout"><Checkout /></BoundedRoute>} />
            <Route path="/cart" element={<RedirectKeepingSearch to="/checkout" />} />
            <Route path="/keranjang" element={<RedirectKeepingSearch to="/checkout" />} />
            <Route path="/bayar" element={<BoundedRoute pageName="Bayar"><Pay /></BoundedRoute>} />
            <Route path="/pay" element={<RedirectKeepingSearch to="/bayar" />} />
            <Route path="/status" element={<BoundedRoute pageName="Status Pesanan"><Status /></BoundedRoute>} />
            <Route path="/order" element={<RedirectKeepingSearch to="/status" />} />
            <Route path="/orders" element={<RedirectKeepingSearch to="/status" />} />
            <Route path="/riwayat" element={<RedirectKeepingSearch to="/status?tab=riwayat" />} />
            <Route path="/admin" element={<BoundedRoute pageName="Admin Login"><AdminLogin /></BoundedRoute>} />
            <Route path="/admin/login" element={<RedirectKeepingSearch to="/admin" />} />
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
      </PageErrorBoundary>

      {showCheckoutOverlay ? (
        <BoundedRoute pageName="Checkout">
          <Suspense fallback={null}>
            <Routes>
              <Route path="/checkout" element={<Checkout />} />
            </Routes>
          </Suspense>
        </BoundedRoute>
      ) : null}
    </Layout>
  );
}

export default function App() {
  const caps = useDeviceCapability();
  const overlayReady = useDeferredOverlayMount();
  useLongTaskMonitor();
  useGlobalInteractionFeedback();

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (caps.saveData || caps.lowMemory || window.location.pathname.startsWith("/admin")) {
      return undefined;
    }

    let cancelled = false;
    const run = () => {
      if (!cancelled) prefetchPrimaryRoutes();
    };

    if (typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(run, { timeout: 2500 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(idleId);
      };
    }

    const timerId = window.setTimeout(run, 1800);
    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, [caps.saveData, caps.lowMemory]);

  return (
    <BrowserRouter>
      <PresenceProvider>
        <ReferralCapture />
        <NetworkBridge />
        {overlayReady ? (
          <>
            <Confetti />
            <StorefrontOverlays />
          </>
        ) : null}
        <Suspense fallback={null}>
          <AchievementToast />
          <AbandonedCartBanner />
          <SwUpdateToast />
        </Suspense>
        <ScrollToTop />
        <FloatingOrderStatus />
        <AppRoutes />
      </PresenceProvider>
    </BrowserRouter>
  );
}
