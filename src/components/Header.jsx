import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Moon, Shield, SunMedium } from "lucide-react";
import { isNavItemActive, SITE_DESKTOP_NAV } from "../lib/siteNav";
import { useCart } from "../context/CartContext";
import { checkAdminAccess } from "../lib/adminAuth";
import { supabase } from "../lib/supabaseClient";

import { useTheme } from "../context/ThemeContext";
import { useHeaderShrink } from "../hooks/useHeaderShrink";
import { useIsMobile } from "../hooks/useIsMobile";
import { COMPACT_NAV_MEDIA } from "../lib/breakpoints";
import { rafThrottle } from "../utils/throttle";
import PromoTicker from "./PromoTicker";
import CartIcon from "./CartIcon";

const HEADER_SHRINK_MS = 280;
const NAV_LINKS = SITE_DESKTOP_NAV;

function AdminHeaderLink({ to, isActive, title }) {
  return (
    <NavLink
      to={to}
      className={`header-iconAction${isActive ? " active" : ""}`}
      aria-label={title}
      title={title}
    >
      <Shield size={18} strokeWidth={2.1} />
    </NavLink>
  );
}

function ThemeToggleButton({ onToggle, isDark }) {
  return (
    <button
      type="button"
      className={`theme-toggle${isDark ? " is-dark" : ""}`}
      onClick={(e) => onToggle(e)}
      aria-label={isDark ? "Aktifkan light mode" : "Aktifkan dark mode"}
      aria-pressed={isDark}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      <span className="theme-toggleGlyph theme-toggleGlyph-light" aria-hidden="true">
        <SunMedium size={13} strokeWidth={2.1} />
      </span>
      <span className="theme-toggleGlyph theme-toggleGlyph-dark" aria-hidden="true">
        <Moon size={13} strokeWidth={2.1} />
      </span>
      <span className="theme-toggleThumb" aria-hidden="true">
        {isDark ? <Moon size={16} strokeWidth={2} /> : <SunMedium size={16} strokeWidth={2} />}
      </span>
    </button>
  );
}

export default function Header() {
  const { items, bumpToken } = useCart();
  useHeaderShrink();
  const { isDark, toggleTheme } = useTheme();
  const cartCount = useMemo(() => items.reduce((sum, item) => sum + item.qty, 0), [items]);
  const isCompactNav = useIsMobile(COMPACT_NAV_MEDIA);
  const headerRef = useRef(null);
  const navRef = useRef(null);
  const location = useLocation();
  const [canAccessAdmin, setCanAccessAdmin] = useState(false);
  const isOnAdminRoute = location.pathname.startsWith("/admin");
  const [pillStyle, setPillStyle] = useState({ left: 0, top: 0, width: 0, height: 0, opacity: 0 });

  const updatePill = useCallback(() => {
    const nav = navRef.current;
    if (!nav) return;
    const activeLink = nav.querySelector("a.active");
    if (activeLink) {
      setPillStyle({
        left: activeLink.offsetLeft,
        top: activeLink.offsetTop,
        width: activeLink.offsetWidth,
        height: activeLink.offsetHeight,
        opacity: 1,
      });
    } else {
      setPillStyle((prev) => ({ ...prev, opacity: 0 }));
    }
  }, []);

  useEffect(() => {
    let alive = true;
    const syncAdmin = () => {
      checkAdminAccess().then((result) => {
        if (alive) setCanAccessAdmin(result.ok);
      });
    };
    syncAdmin();
    const { data: sub } = supabase.auth.onAuthStateChange(syncAdmin);
    return () => {
      alive = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  useLayoutEffect(() => {
    updatePill();
  }, [location.pathname, updatePill]);

  useEffect(() => {
    updatePill();
    if (typeof window === "undefined") return undefined;
    window.addEventListener("resize", updatePill);
    return () => window.removeEventListener("resize", updatePill);
  }, [updatePill]);

  useEffect(() => {
    const timer = window.setTimeout(updatePill, HEADER_SHRINK_MS + 20);
    return () => window.clearTimeout(timer);
  }, [updatePill]);
  const [pillBump, setPillBump] = useState(false);
  const pillBumpTimerRef = useRef(null);

  useEffect(() => {
    if (!bumpToken) return undefined;
    setPillBump(true);
    window.clearTimeout(pillBumpTimerRef.current);
    pillBumpTimerRef.current = window.setTimeout(() => setPillBump(false), 450);
    return () => window.clearTimeout(pillBumpTimerRef.current);
  }, [bumpToken]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const root = document.documentElement;
    let observer;

    const syncHeaderOffset = rafThrottle(() => {
      const nextHeight = Math.ceil(headerRef.current?.getBoundingClientRect().height || 0);
      root.style.setProperty("--site-header-offset", `${nextHeight}px`);
    });

    syncHeaderOffset();

    if (typeof ResizeObserver !== "undefined" && headerRef.current) {
      observer = new ResizeObserver(syncHeaderOffset);
      observer.observe(headerRef.current);
    } else {
      window.addEventListener("resize", syncHeaderOffset);
    }

    return () => {
      syncHeaderOffset.cancel();
      window.removeEventListener("resize", syncHeaderOffset);
      observer?.disconnect();
    };
  }, [location.pathname]);

  return (
    <>
      <header ref={headerRef} className="header is-shrunk">
        <PromoTicker />
        <div className="container header-inner">
          <div className="header-mobile-left">
            <ThemeToggleButton onToggle={toggleTheme} isDark={isDark} />
            {canAccessAdmin ? (
              <AdminHeaderLink
                to="/admin/dashboard"
                isActive={isOnAdminRoute}
                title="Admin Dashboard"
              />
            ) : null}
          </div>

          <Link to="/" className="brand" aria-label="Beranda Imzaqi Store">
            <img className="brand-img" src="/icon.png" alt="imzaqi.store" />
          </Link>

          <nav ref={navRef} className="nav desktop-only" aria-label="Navigasi utama">
            <div
              className="nav-active-pill"
              style={{
                transform: `translate(${pillStyle.left}px, ${pillStyle.top}px)`,
                width: `${pillStyle.width}px`,
                height: `${pillStyle.height}px`,
                opacity: pillStyle.opacity,
              }}
            />
            {NAV_LINKS.map((link) => {
              const isActive = isNavItemActive(location.pathname, link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={isActive ? "active" : ""}
                  aria-current={isActive ? "page" : undefined}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="header-actions">
            <div className="header-cart-container">
              <Link
                to="/checkout"
                state={location.pathname === "/checkout" ? undefined : { backgroundLocation: location }}
                className="header-cart"
                aria-label={
                  cartCount > 0
                    ? `Buka checkout, ${cartCount} item di keranjang`
                    : "Buka checkout, keranjang kosong"
                }
              >
                <CartIcon />
                {cartCount > 0 ? (
                  <span className={`pill${pillBump ? " is-bumping" : ""}`} key={bumpToken}>
                    {cartCount}
                  </span>
                ) : null}
              </Link>
            </div>

            <div className="desktop-only header-desktop-toggles">
              <ThemeToggleButton onToggle={toggleTheme} isDark={isDark} />
              {canAccessAdmin ? (
                <AdminHeaderLink
                  to="/admin/dashboard"
                  isActive={isOnAdminRoute}
                  title="Admin Dashboard"
                />
              ) : null}
            </div>
          </div>
        </div>
      </header>

    </>
  );
}
