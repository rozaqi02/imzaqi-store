import React from "react";
import { useLocation } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";
import { useRevealOnScroll } from "../hooks/useRevealOnScroll";

export default function Layout({ children }) {
  const location = useLocation();
  // Re-attach reveal observer whenever route changes.
  useRevealOnScroll(location.pathname);

  return (
    <div className="app-shell">
      <Header />
      <main className="app-main">
        <div key={location.pathname} className="route-transition">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}
