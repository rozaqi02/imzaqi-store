import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { NavLink, useLocation } from "react-router-dom";
import {
  Activity,
  Grid2x2,
  House,
  MessageSquareQuote,
} from "lucide-react";
import { useIsMobile } from "../hooks/useIsMobile";
import { isFunnelPath } from "../hooks/useFunnelRoute";
import { BOTTOM_NAV_MEDIA } from "../lib/breakpoints";
import { isNavItemActive, SITE_BOTTOM_NAV } from "../lib/siteNav";

const ICONS = {
  "/": House,
  "/produk": Grid2x2,
  "/testimoni": MessageSquareQuote,
  "/status": Activity,
};

function isBottomNavHidden(pathname) {
  if (isFunnelPath(pathname)) return true;
  if (pathname.startsWith("/admin")) return true;
  return false;
}

function scrollActiveNavToTop() {
  if (typeof window === "undefined") return;
  const reduce =
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
}

export default function BottomNav() {
  const location = useLocation();
  const showBottomNav = useIsMobile(BOTTOM_NAV_MEDIA);
  const navRef = useRef(null);
  const hidden = !showBottomNav || isBottomNavHidden(location.pathname);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    document.body.classList.toggle("has-bottom-nav", !hidden);
    return () => document.body.classList.remove("has-bottom-nav");
  }, [hidden]);

  useEffect(() => {
    if (hidden || typeof document === "undefined") return undefined;

    const root = document.documentElement;
    const syncOffset = () => {
      const height = Math.ceil(navRef.current?.getBoundingClientRect().height || 0);
      root.style.setProperty("--site-bottom-nav-offset", `${height}px`);
    };

    syncOffset();

    let observer;
    if (typeof ResizeObserver !== "undefined" && navRef.current) {
      observer = new ResizeObserver(syncOffset);
      observer.observe(navRef.current);
      return () => {
        observer.disconnect();
        root.style.setProperty("--site-bottom-nav-offset", "0px");
      };
    }

    // Fallback ke resize event hanya jika ResizeObserver tidak tersedia
    window.addEventListener("resize", syncOffset);
    return () => {
      window.removeEventListener("resize", syncOffset);
      root.style.setProperty("--site-bottom-nav-offset", "0px");
    };
  }, [hidden, location.pathname]);

  if (hidden || typeof document === "undefined") return null;

  return createPortal(
    <nav ref={navRef} className="bottom-nav" aria-label="Navigasi utama">
      <ul className="bottom-nav-list">
        {SITE_BOTTOM_NAV.map((item) => {
          const Icon = ICONS[item.to] || House;
          const active = isNavItemActive(location.pathname, item.to);

          return (
            <li key={item.to} className="bottom-nav-itemWrap">
              <NavLink
                to={item.to}
                className={`bottom-nav-item${active ? " is-active" : ""}`}
                aria-current={active ? "page" : undefined}
                onClick={(event) => {
                  if (!active) return;
                  event.preventDefault();
                  scrollActiveNavToTop();
                }}
              >
                <span className="bottom-nav-icon" aria-hidden="true">
                  <Icon size={20} strokeWidth={active ? 2.4 : 2.1} />
                </span>
                <span className="bottom-nav-label">{item.shortLabel || item.label}</span>
                {active ? <span className="bottom-nav-activeDot" aria-hidden="true" /> : null}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>,
    document.body
  );
}