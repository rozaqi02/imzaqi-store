import React from "react";
import { useLocation } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";
import { useRevealOnScroll } from "../hooks/useRevealOnScroll";

export default function Layout({ children, routeKey }) {
  const location = useLocation();
  const revealKey = routeKey || location.pathname;
  // Re-attach reveal observer whenever route changes.
  useRevealOnScroll(revealKey);

  return (
    <div className="app-shell">
      {/* Global super premium background layers (fixed) */}
      <div className="global-bg" aria-hidden="true" />
      <div className="global-noise" aria-hidden="true" />

      <Header />
      <main className="app-main">
        <div key={revealKey} className="route-transition">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}
