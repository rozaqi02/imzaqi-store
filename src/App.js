import React from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Layout from "./components/Layout";
import RouteProgress from "./components/RouteProgress";
import ProtectedRoute from "./components/ProtectedRoute";
import NetworkBridge from "./components/NetworkBridge";
import Home from "./pages/Home";
import Products from "./pages/Products";
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
  const location = useLocation();
  usePageView(location.pathname);
  return null;
}

// smooth scroll to top on route change
function ScrollToTop() {
  const { pathname } = useLocation();

  React.useEffect(() => {
    const reduce = typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    });
  }, [pathname]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <AnalyticsBridge />
      <NetworkBridge />
      <ScrollToTop />
      <RouteProgress />
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
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
      </Layout>
    </BrowserRouter>
  );
}
