import React from "react";
import { useLocation } from "react-router-dom";
import Header from "./Header";
import BottomNav from "./BottomNav";
import Footer from "./Footer";
import { isFunnelPath } from "../hooks/useFunnelRoute";
import { useRevealOnScroll } from "../hooks/useRevealOnScroll";
import { useAdaptiveMotion } from "../hooks/useAdaptiveMotion";
import { useRouteDirection } from "../hooks/useRouteDirection";
import { PHONE_LAYOUT_MEDIA } from "../lib/breakpoints";
import { useIsMobile } from "../hooks/useIsMobile";

export default function Layout({ children, routeKey }) {
  const location = useLocation();
  const revealKey = routeKey || location.pathname;
  const isAdminDashboardRoute = location.pathname.startsWith("/admin/dashboard");
  const isCheckoutOverlay =
    location.pathname === "/checkout" && Boolean(location.state?.backgroundLocation);
  const isCheckoutRoute = location.pathname === "/checkout" && !isCheckoutOverlay;
  const isCatalogRoute =
    location.pathname === "/produk" || location.pathname.startsWith("/produk/");

  const isMobile = useIsMobile(PHONE_LAYOUT_MEDIA);

  useAdaptiveMotion();
  const routeDirection = useRouteDirection(revealKey);
  useRevealOnScroll(revealKey);

  const hideFooter = isAdminDashboardRoute || (isCheckoutRoute && isMobile);
  const isFunnel = isFunnelPath(location.pathname);

  React.useEffect(() => {
    if (typeof document === "undefined") return undefined;
    document.body.classList.toggle("is-funnel", isFunnel);
    return () => {
      document.body.classList.remove("is-funnel");
    };
  }, [isFunnel]);

  return (
    <div className="app-shell">
      <div className="global-bg" aria-hidden="true" />
      <div className="global-noise" aria-hidden="true" />

      <Header />
      <main
        className={`app-main${isAdminDashboardRoute ? " app-main-admin" : ""}${isCatalogRoute ? " app-main-catalog" : ""}${isCheckoutRoute ? " app-main-checkout" : ""}`}
      >
        <div key={revealKey} className={`route-transition route-transition--${routeDirection}`}>
          {children}
        </div>
      </main>
      {hideFooter ? null : <Footer key={revealKey} />}
      <BottomNav />
    </div>
  );
}
