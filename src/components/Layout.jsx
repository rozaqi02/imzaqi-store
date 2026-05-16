import React from "react";
import { useLocation } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";
import { useRevealOnScroll } from "../hooks/useRevealOnScroll";
import { useAdaptiveMotion } from "../hooks/useAdaptiveMotion";

export default function Layout({ children, routeKey }) {
  const location = useLocation();
  const revealKey = routeKey || location.pathname;
  const isAdminDashboardRoute = location.pathname.startsWith("/admin/dashboard");
  useAdaptiveMotion();
  // Re-attach reveal observer whenever route changes.
  useRevealOnScroll(revealKey);

  return (
    <div className="app-shell">
      {/* Global background layers (fixed, paint-isolated) */}
      <div className="global-bg" aria-hidden="true" />
      <div className="global-noise" aria-hidden="true" />

      <Header />
      <main className={`app-main${isAdminDashboardRoute ? " app-main-admin" : ""}`}>
        {/* key forces remount on route change for enter animation.
            contain:layout prevents this subtree from triggering full-page repaints. */}
        <div key={revealKey} className="route-transition" style={{ contain: "layout" }}>
          {children}
        </div>
      </main>
      {isAdminDashboardRoute ? null : <Footer />}
    </div>
  );
}
