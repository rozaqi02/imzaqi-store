import React from "react";
import { useLocation } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";
import { useRevealOnScroll } from "../hooks/useRevealOnScroll";
import { useAdaptiveMotion } from "../hooks/useAdaptiveMotion";
import { useRouteDirection } from "../hooks/useRouteDirection";

export default function Layout({ children, routeKey }) {
  const location = useLocation();
  const revealKey = routeKey || location.pathname;
  const isAdminDashboardRoute = location.pathname.startsWith("/admin/dashboard");
  const isCheckoutRoute = location.pathname === "/checkout";
  const isCatalogRoute =
    location.pathname === "/produk" || location.pathname.startsWith("/produk/");

  // Check if viewport is mobile (width <= 720px)
  const [isMobile, setIsMobile] = React.useState(() => 
    typeof window !== "undefined" ? window.innerWidth <= 720 : false
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 720);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useAdaptiveMotion();
  const routeDirection = useRouteDirection(revealKey);
  // Re-attach reveal observer whenever route changes.
  useRevealOnScroll(revealKey);

  // Footer hidden on mobile checkout only; header always visible
  const hideFooter = isCheckoutRoute && isMobile;

  return (
    <div className="app-shell">
      {/* Global background layers (fixed, paint-isolated) */}
      <div className="global-bg" aria-hidden="true" />
      <div className="global-noise" aria-hidden="true" />

      <Header />
      <main
        className={`app-main${isAdminDashboardRoute ? " app-main-admin" : ""}${isCatalogRoute ? " app-main-catalog" : ""}${isCheckoutRoute ? " app-main-checkout" : ""}`}
      >
        {/* key forces remount on route change for enter animation.
            contain:layout prevents this subtree from triggering full-page repaints. */}
        <div key={revealKey} className={`route-transition route-transition--${routeDirection}`}>
          {children}
        </div>
      </main>
      {isAdminDashboardRoute || hideFooter ? null : <Footer />}
    </div>
  );
}

