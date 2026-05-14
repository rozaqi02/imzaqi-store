import React from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Layout from "./components/Layout";
import RouteProgress from "./components/RouteProgress";
import ProtectedRoute from "./components/ProtectedRoute";
import NetworkBridge from "./components/NetworkBridge";
import PolishEffects from "./components/PolishEffects";
import Confetti from "./components/Confetti";
import AssistantBubble from "./components/AssistantBubble";
import Home from "./pages/Home";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import About from "./pages/About";
import Testimonials from "./pages/Testimonials";
import Checkout from "./pages/Checkout";
import Pay from "./pages/Pay";
import Status from "./pages/Status";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import NotFound from "./pages/NotFound";
import { usePageView } from "./hooks/usePageView";

function AnalyticsBridge() {
  usePageView();
  return null;
}

// smooth scroll to top on route change
function ScrollToTop() {
  const location = useLocation();
  const displayLocation = location.state?.backgroundLocation || location;
  const pathname = displayLocation.pathname;

  React.useEffect(() => {
    const reduce = typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = typeof window !== "undefined" &&
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

  return (
    <Layout routeKey={displayLocation.pathname}>
      <Routes location={displayLocation}>
        <Route path="/" element={<Home />} />
        <Route path="/produk/:slug" element={<ProductDetail />} />
        <Route path="/produk" element={<Products />} />
        <Route path="/tentang" element={<About />} />
        <Route path="/testimoni" element={<Testimonials />} />

        <Route path="/checkout" element={<Checkout />} />
        <Route path="/bayar" element={<Pay />} />
        <Route path="/status" element={<Status />} />

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

      {backgroundLocation ? (
        <Routes>
          <Route path="/checkout" element={<Checkout />} />
        </Routes>
      ) : null}
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AnalyticsBridge />
      <NetworkBridge />
      <PolishEffects />
      <Confetti />
      <AssistantBubble />
      <ScrollToTop />
      <RouteProgress />
      <AppRoutes />
    </BrowserRouter>
  );
}
