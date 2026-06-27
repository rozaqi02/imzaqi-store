import React from "react";
import { useLocation } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";
import { useRevealOnScroll } from "../hooks/useRevealOnScroll";
import { useAdaptiveMotion } from "../hooks/useAdaptiveMotion";
import { useRouteDirection } from "../hooks/useRouteDirection";
import { rafThrottle } from "../utils/throttle";

// Separate Footer wrapper that starts hidden and reveals after 800ms
function DelayedFooter() {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(timer);
  }, []); // empty deps — remount on key change handles reset

  // Render an invisible placeholder matching footer height so no layout jump
  if (!visible) return null;
  return <Footer />;
}

export default function Layout({ children, routeKey }) {
  const location = useLocation();
  const revealKey = routeKey || location.pathname;
  const isAdminDashboardRoute = location.pathname.startsWith("/admin/dashboard");
  const isCheckoutRoute = location.pathname === "/checkout";
  const isCatalogRoute =
    location.pathname === "/produk" || location.pathname.startsWith("/produk/");

  const [isMobile, setIsMobile] = React.useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= 720 : false
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = rafThrottle(() => {
      setIsMobile(window.innerWidth <= 720);
    });
    window.addEventListener("resize", handleResize);
    return () => {
      handleResize.cancel();
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Neumorphic Light Tracking Global Mouse Move Observer
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const isCoarse = window.matchMedia("(pointer: coarse), (max-width: 920px)").matches;
    if (isCoarse) return;

    let lastEl = null;

    const handleMouseMove = (e) => {
      const el = e.target.closest(
        ".product-tile, .home-promoCard, .home-howCard, .st-infoCard, .st-card, .pay-card, .card"
      );

      if (el) {
        if (lastEl && lastEl !== el) {
          lastEl.style.setProperty("--light-x", "1");
          lastEl.style.setProperty("--light-y", "1");
        }
        lastEl = el;

        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dx = e.clientX - centerX;
        const dy = e.clientY - centerY;

        const lx = -dx / (rect.width / 2);
        const ly = -dy / (rect.height / 2);

        const boundedLx = Math.max(-1.3, Math.min(1.3, lx));
        const boundedLy = Math.max(-1.3, Math.min(1.3, ly));

        el.style.setProperty("--light-x", boundedLx.toFixed(3));
        el.style.setProperty("--light-y", boundedLy.toFixed(3));
      } else if (lastEl) {
        lastEl.style.setProperty("--light-x", "1");
        lastEl.style.setProperty("--light-y", "1");
        lastEl = null;
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (lastEl) {
        lastEl.style.setProperty("--light-x", "1");
        lastEl.style.setProperty("--light-y", "1");
      }
    };
  }, []);

  useAdaptiveMotion();
  const routeDirection = useRouteDirection(revealKey);
  useRevealOnScroll(revealKey);

  const hideFooter = isAdminDashboardRoute || (isCheckoutRoute && isMobile);

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
      {hideFooter ? null : <DelayedFooter key={revealKey} />}
    </div>
  );
}
