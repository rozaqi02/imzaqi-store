import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import {
  Activity,
  Grid2x2,
  House,
  Info,
  Menu,
  MessageSquareQuote,
  Moon,
  Shield,
  SunMedium,
  X,
} from "lucide-react";
import { useCart } from "../context/CartContext";
import { useTheme } from "../context/ThemeContext";

const MOBILE_BREAKPOINT = "(max-width: 720px)";

function CartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M6.5 6H21l-1.6 8.2a2 2 0 0 1-2 1.6H9.1a2 2 0 0 1-2-1.6L5.2 3.5H2.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM18 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
        fill="currentColor"
      />
    </svg>
  );
}

const primaryItems = [
  { to: "/", label: "Home", icon: House },
  { to: "/produk", label: "Produk", icon: Grid2x2 },
  { to: "/tentang", label: "Tentang", icon: Info },
  { to: "/testimoni", label: "Testimoni", icon: MessageSquareQuote },
];

const utilityItems = [
  { to: "/status", label: "Status", icon: Activity },
  { to: "/admin", label: "Admin", icon: Shield },
];

function ThemeToggleButton({ onToggle, isDark }) {
  return (
    <button
      type="button"
      className={`theme-toggle${isDark ? " is-dark" : ""}`}
      onClick={onToggle}
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

function MenuLink({ item }) {
  const Icon = item.icon;

  return (
    <NavLink to={item.to} className={({ isActive }) => (isActive ? "active" : "")}>
      <span className="menu-icon">
        <Icon size={18} strokeWidth={2.1} />
      </span>
      <span className="menu-label">{item.label}</span>
      <span className="active-indicator" aria-hidden="true" />
    </NavLink>
  );
}

function MobileMenu({ open, onClose, isDark, toggleTheme }) {
  const menuRef = useRef(null);
  const location = useLocation();
  const previousPathRef = useRef(location.pathname);
  const closeTimerRef = useRef(null);
  const openFrameRef = useRef(null);
  const [phase, setPhase] = useState(open ? "open" : "closed");

  const requestClose = useCallback(() => {
    if (!open || phase === "closing") return;
    setPhase("closing");
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      onClose();
      setPhase("closed");
    }, 180);
  }, [onClose, open, phase]);

  useEffect(() => {
    window.clearTimeout(closeTimerRef.current);
    window.cancelAnimationFrame(openFrameRef.current);

    if (open) {
      openFrameRef.current = window.requestAnimationFrame(() => {
        openFrameRef.current = window.requestAnimationFrame(() => {
          setPhase("open");
        });
      });

      return () => window.cancelAnimationFrame(openFrameRef.current);
    }

    setPhase("closed");
    return undefined;
  }, [open]);

  useEffect(
    () => () => {
      window.clearTimeout(closeTimerRef.current);
      window.cancelAnimationFrame(openFrameRef.current);
    },
    []
  );

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") requestClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, requestClose]);

  useEffect(() => {
    if (!open) {
      previousPathRef.current = location.pathname;
      return undefined;
    }

    if (previousPathRef.current !== location.pathname) {
      requestClose();
    }

    previousPathRef.current = location.pathname;
    return undefined;
  }, [location.pathname, open, requestClose]);

  useEffect(() => {
    if (!open || phase !== "open" || !menuRef.current) return undefined;
    const firstInteractive = menuRef.current.querySelector("button, a");
    firstInteractive?.focus();
    return undefined;
  }, [open, phase]);

  if (typeof document === "undefined" || (!open && phase === "closed")) return null;

  const stateClass = phase === "closing" ? "is-closing" : phase === "open" ? "is-open" : "";
  const backdropClass = `mobile-backdrop mobile-backdrop-lite ${stateClass}`.trim();
  const menuClass = `mobile-menu mobile-menu-lite ${stateClass}`.trim();

  return createPortal(
    <>
      <div className={backdropClass} onClick={requestClose} aria-hidden="true" />

      <aside ref={menuRef} className={menuClass} role="dialog" aria-modal="true" aria-label="Navigasi mobile">
        <button className="mobile-menu-close" onClick={requestClose} aria-label="Tutup menu">
          <X size={18} strokeWidth={2.2} />
        </button>

        <div className="mobile-menu-header">
          <h3>Menu</h3>
          <p>Akses cepat.</p>
        </div>

        <div className="mobile-menu-stack">
          {primaryItems.map((item) => (
            <MenuLink key={item.to} item={item} />
          ))}
        </div>

        <div className="mobile-menu-divider" />

        <div className="mobile-menu-stack">
          {utilityItems.map((item) => (
            <MenuLink key={item.to} item={item} />
          ))}
        </div>

        <div className="mobile-menu-footer">
          <ThemeToggleButton onToggle={toggleTheme} isDark={isDark} />
          <p className="menu-footer-text">Imzaqi Store Web V.3.9</p>
        </div>
      </aside>
    </>,
    document.body
  );
}

export default function Header() {
  const { items } = useCart();
  const { isDark, toggleTheme } = useTheme();
  const cartCount = useMemo(() => items.reduce((sum, item) => sum + item.qty, 0), [items]);
  const [open, setOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(MOBILE_BREAKPOINT).matches : false
  );
  const headerRef = useRef(null);
  const location = useLocation();
  const handleOpen = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);

  useEffect(() => {
    document.body.classList.toggle("nav-open", open && isMobileViewport);
    return () => document.body.classList.remove("nav-open");
  }, [isMobileViewport, open]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia(MOBILE_BREAKPOINT);
    const sync = () => setIsMobileViewport(media.matches);
    sync();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", sync);
      return () => media.removeEventListener("change", sync);
    }
    media.addListener(sync);
    return () => media.removeListener(sync);
  }, []);

  useEffect(() => {
    if (!isMobileViewport && open) setOpen(false);
  }, [isMobileViewport, open]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const root = document.documentElement;
    let frame = 0;
    let observer;

    const syncHeaderOffset = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const nextHeight = Math.ceil(headerRef.current?.getBoundingClientRect().height || 0);
        root.style.setProperty("--site-header-offset", `${nextHeight}px`);
      });
    };

    syncHeaderOffset();
    window.addEventListener("resize", syncHeaderOffset);

    if (typeof ResizeObserver !== "undefined" && headerRef.current) {
      observer = new ResizeObserver(syncHeaderOffset);
      observer.observe(headerRef.current);
    }

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", syncHeaderOffset);
      observer?.disconnect();
    };
  }, [location.pathname]);

  return (
    <>
      <header ref={headerRef} className="header">
        <div className="container header-inner">
          <Link to="/" className="brand">
            <img className="brand-img" src="/icon.png" alt="imzaqi.store" />
          </Link>

          <nav className="nav desktop-only">
            <NavLink to="/">Home</NavLink>
            <NavLink to="/produk">Produk</NavLink>
            <NavLink to="/tentang">Tentang</NavLink>
            <NavLink to="/testimoni">Testimoni</NavLink>
            <NavLink to="/status">Status</NavLink>
          </nav>

          <div className="header-actions">
            <Link to="/checkout" state={{ backgroundLocation: location }} className="header-cart">
              <CartIcon />
              {cartCount > 0 ? <span className="pill">{cartCount}</span> : null}
            </Link>

            <div className="desktop-only">
              <ThemeToggleButton onToggle={toggleTheme} isDark={isDark} />
            </div>

            <NavLink
              to="/admin"
              className={`header-iconAction desktop-only${location.pathname.startsWith("/admin") ? " active" : ""}`}
              aria-label="Admin"
              title="Admin"
            >
              <Shield size={18} strokeWidth={2.1} />
            </NavLink>

            {isMobileViewport ? (
              <button
                className="nav-toggle"
                onClick={handleOpen}
                aria-label="Buka menu"
                aria-expanded={open}
                type="button"
              >
                <Menu size={18} strokeWidth={2.4} />
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {isMobileViewport ? <MobileMenu open={open} onClose={handleClose} isDark={isDark} toggleTheme={toggleTheme} /> : null}
    </>
  );
}
