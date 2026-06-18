import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  CircleHelp,
  Grid2x2,
  House,
  Menu,
  MessageSquareQuote,
  Moon,
  Shield,
  SunMedium,
  X,
} from "lucide-react";
import { useCart } from "../context/CartContext";
import { useTheme } from "../context/ThemeContext";
import { useDialogA11y } from "../hooks/useDialogA11y";
import { useHeaderShrink } from "../hooks/useHeaderShrink";

const MOBILE_BREAKPOINT = "(max-width: 720px)";
const MOBILE_MENU_ANIMATION_MS = 260;
const HEADER_SHRINK_MS = 280;
const NAV_PILL_EASE = [0.22, 1, 0.36, 1];
const NAV_LINKS = [
  { to: "/", label: "Home" },
  { to: "/produk", label: "Katalog" },
  { to: "/tentang", label: "FAQ" },
  { to: "/testimoni", label: "Testimoni" },
  { to: "/status", label: "Status Order" },
];

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
  { to: "/produk", label: "Katalog", icon: Grid2x2 },
  { to: "/tentang", label: "FAQ", icon: CircleHelp },
  { to: "/testimoni", label: "Testimoni", icon: MessageSquareQuote },
];

const utilityItems = [
  { to: "/status", label: "Status & Riwayat", icon: Activity },
  { to: "/admin", label: "Admin", icon: Shield },
];

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

function MenuLink({ item, index }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      className={({ isActive }) => (isActive ? "active" : "")}
      style={{ "--menu-i": index }}
    >
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
  const [phase, setPhase] = useState("closed");

  const requestClose = useCallback(() => {
    if (!open || phase === "closing") return;
    setPhase("closing");
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      onClose();
      setPhase("closed");
    }, MOBILE_MENU_ANIMATION_MS);
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

  useDialogA11y({
    open: open && phase !== "closed",
    containerRef: menuRef,
    onClose: requestClose,
    initialFocusSelector: ".mobile-menu-close",
  });

  if (typeof document === "undefined" || (!open && phase === "closed")) return null;

  const stateClass = phase === "closing" ? "is-closing" : phase === "open" ? "is-open" : "";
  const backdropClass = `mobile-backdrop mobile-backdrop-lite ${stateClass}`.trim();
  const menuClass = `mobile-menu mobile-menu-lite ${stateClass}`.trim();

  return createPortal(
    <>
      <div className={backdropClass} onClick={requestClose} aria-hidden="true" />

      <aside ref={menuRef} className={menuClass} role="dialog" aria-modal="true" aria-label="Navigasi mobile">
        <button className="mobile-menu-close" type="button" onClick={requestClose} aria-label="Tutup menu">
          <X size={18} strokeWidth={2.2} />
        </button>

        <div className="mobile-menu-header">
          <h3>Menu</h3>
          <p>Mau ke mana nih?</p>
        </div>

        <div className="mobile-menu-stack">
          {primaryItems.map((item, idx) => (
            <MenuLink key={item.to} item={item} index={idx} />
          ))}
        </div>

        <div className="mobile-menu-divider" />

        <div className="mobile-menu-stack">
          {utilityItems.map((item, idx) => (
            <MenuLink key={item.to} item={item} index={primaryItems.length + 1 + idx} />
          ))}
        </div>

        <div className="mobile-menu-footer">
          <ThemeToggleButton onToggle={toggleTheme} isDark={isDark} />
          <p className="menu-footer-text">Imzaqi Store App V.4.2</p>
        </div>
      </aside>
    </>,
    document.body
  );
}

export default function Header() {
  const { items, remove, bumpToken, lastAddedVariantId } = useCart();
  const isHeaderShrunk = useHeaderShrink();
  const { isDark, toggleTheme } = useTheme();
  const cartCount = useMemo(() => items.reduce((sum, item) => sum + item.qty, 0), [items]);
  const totalPrice = useMemo(() => items.reduce((sum, item) => sum + item.price_idr * item.qty, 0), [items]);
  const [open, setOpen] = useState(false);
  const [pillStyle, setPillStyle] = useState({ width: 0, height: 0, x: 0, y: 0, opacity: 0 });
  const [hoverStyle, setHoverStyle] = useState({ width: 0, height: 0, x: 0, y: 0, opacity: 0 });
  const navRef = useRef(null);
  const navRefs = useRef([]);
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(MOBILE_BREAKPOINT).matches : false
  );
  const headerRef = useRef(null);
  const location = useLocation();
  const handleOpen = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);

  const [showMiniCart, setShowMiniCart] = useState(false);
  const [pillBump, setPillBump] = useState(false);
  const miniCartTimerRef = useRef(null);
  const pillBumpTimerRef = useRef(null);

  useEffect(() => {
    if (!bumpToken) return undefined;
    setPillBump(true);
    window.clearTimeout(pillBumpTimerRef.current);
    pillBumpTimerRef.current = window.setTimeout(() => setPillBump(false), 450);
    return () => window.clearTimeout(pillBumpTimerRef.current);
  }, [bumpToken]);

  const handleCartMouseEnter = () => {
    if (isMobileViewport) return;
    window.clearTimeout(miniCartTimerRef.current);
    setShowMiniCart(true);
  };

  const handleCartMouseLeave = () => {
    if (isMobileViewport) return;
    miniCartTimerRef.current = window.setTimeout(() => {
      setShowMiniCart(false);
    }, 240);
  };

  const formatPrice = useCallback((price) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price).replace("Rp", "Rp ");
  }, []);

  useEffect(() => {
    return () => {
      window.clearTimeout(miniCartTimerRef.current);
    };
  }, []);

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

  const syncNavPill = useCallback(() => {
    if (isMobileViewport) return;

    const activeIdx = NAV_LINKS.findIndex(
      (link) => location.pathname === link.to || (link.to !== "/" && location.pathname.startsWith(link.to))
    );

    const activeEl = activeIdx >= 0 ? navRefs.current[activeIdx] : null;
    const navEl = navRef.current;

    if (activeEl && navEl) {
      const navRect = navEl.getBoundingClientRect();
      const linkRect = activeEl.getBoundingClientRect();
      setPillStyle({
        width: linkRect.width,
        height: linkRect.height,
        x: linkRect.left - navRect.left,
        y: linkRect.top - navRect.top,
        opacity: 1,
      });
      return;
    }

    setPillStyle((prev) => ({ ...prev, opacity: 0 }));
  }, [isMobileViewport, location.pathname]);

  useLayoutEffect(() => {
    syncNavPill();
    window.addEventListener("resize", syncNavPill);
    return () => window.removeEventListener("resize", syncNavPill);
  }, [syncNavPill]);

  useEffect(() => {
    if (isMobileViewport) return undefined;

    let raf = 0;
    const startedAt = performance.now();

    const tick = (now) => {
      syncNavPill();
      if (now - startedAt < HEADER_SHRINK_MS + 48) {
        raf = window.requestAnimationFrame(tick);
      }
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [isHeaderShrunk, isMobileViewport, syncNavPill]);

  useEffect(() => {
    if (isMobileViewport || typeof ResizeObserver === "undefined") return undefined;

    const observer = new ResizeObserver(() => syncNavPill());
    const navEl = navRef.current;
    if (navEl) observer.observe(navEl);
    navRefs.current.forEach((link) => {
      if (link) observer.observe(link);
    });

    return () => observer.disconnect();
  }, [isMobileViewport, location.pathname, syncNavPill]);

  return (
    <>
      <header ref={headerRef} className={`header${isHeaderShrunk ? " is-shrunk" : ""}`}>
        <div className="container header-inner">
          <Link to="/" className="brand">
            <img className="brand-img" src="/icon.png" alt="imzaqi.store" />
          </Link>

          <nav
            ref={navRef}
            className="nav desktop-only"
            style={{ position: "relative" }}
            onMouseLeave={() => setHoverStyle((prev) => ({ ...prev, opacity: 0 }))}
          >
            <motion.div
              className="nav-active-pill"
              initial={false}
              animate={{
                width: pillStyle.width,
                height: pillStyle.height,
                x: pillStyle.x,
                y: pillStyle.y,
                opacity: pillStyle.opacity,
              }}
              transition={{ duration: HEADER_SHRINK_MS / 1000, ease: NAV_PILL_EASE }}
              style={{ left: 0, top: 0, bottom: "auto", right: "auto" }}
            />
            <motion.div
              className="nav-hover-pill"
              initial={false}
              animate={{
                width: hoverStyle.width,
                height: hoverStyle.height,
                x: hoverStyle.x,
                y: hoverStyle.y,
                opacity: hoverStyle.opacity,
              }}
              transition={{ duration: 0.22, ease: NAV_PILL_EASE }}
              style={{ left: 0, top: 0, bottom: "auto", right: "auto" }}
            />
            {NAV_LINKS.map((link, idx) => {
              const isActive = location.pathname === link.to || (link.to !== "/" && location.pathname.startsWith(link.to));
              return (
                <Link 
                  key={link.to} 
                  to={link.to} 
                  className={isActive ? "active" : ""} 
                  ref={(el) => (navRefs.current[idx] = el)}
                  style={{ position: "relative", zIndex: 1 }}
                  onMouseEnter={() => {
                    const el = navRefs.current[idx];
                    const navEl = navRef.current;
                    if (el && navEl) {
                      const navRect = navEl.getBoundingClientRect();
                      const linkRect = el.getBoundingClientRect();
                      setHoverStyle({
                        width: linkRect.width,
                        height: linkRect.height,
                        x: linkRect.left - navRect.left,
                        y: linkRect.top - navRect.top,
                        opacity: 1,
                      });
                    }
                  }}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="header-actions">
            <div
              className="header-cart-container"
              onMouseEnter={handleCartMouseEnter}
              onMouseLeave={handleCartMouseLeave}
              style={{ position: "relative" }}
            >
              <Link to="/checkout" state={{ backgroundLocation: location }} className="header-cart">
                <CartIcon />
                {cartCount > 0 ? (
                  <span className={`pill${pillBump ? " is-bumping" : ""}`} key={bumpToken}>
                    {cartCount}
                  </span>
                ) : null}
              </Link>

              <AnimatePresence>
                {showMiniCart && !isMobileViewport && (
                  <motion.div
                    className="mini-cart-popover"
                    initial={{ opacity: 0, y: 12, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                  >
                    <div className="mini-cart-header">
                      <h4>Keranjang</h4>
                      <span className="mini-cart-count">{cartCount} Item</span>
                    </div>

                    <div className="mini-cart-divider" />

                    {items.length === 0 ? (
                      <div className="mini-cart-empty">
                        <p>Keranjang kosong</p>
                      </div>
                    ) : (
                      <>
                        <div className="mini-cart-items">
                          {items.map((item) => (
                            <div
                              key={item.variant_id}
                              className={`mini-cart-item${item.variant_id === lastAddedVariantId ? " is-new" : ""}`}
                            >
                              {item.product_icon_url ? (
                                <img src={item.product_icon_url} alt={item.product_name} className="mini-cart-item-icon" />
                              ) : (
                                <div className="mini-cart-item-fallback">
                                  {item.product_name?.charAt(0) || "P"}
                                </div>
                              )}
                              <div className="mini-cart-item-details">
                                <div className="mini-cart-item-title">{item.product_name}</div>
                                <div className="mini-cart-item-subtitle">{item.variant_name}</div>
                                <div className="mini-cart-item-price">
                                  {item.qty} × {formatPrice(item.price_idr)}
                                </div>
                              </div>
                              <button
                                type="button"
                                className="mini-cart-item-remove"
                                onClick={() => remove(item.variant_id)}
                                title="Hapus item"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>

                        <div className="mini-cart-divider" />

                        <div className="mini-cart-footer">
                          <div className="mini-cart-total">
                            <span>Subtotal</span>
                            <strong>{formatPrice(totalPrice)}</strong>
                          </div>
                          <Link
                            to="/checkout"
                            state={{ backgroundLocation: location }}
                            className="btn btn-sm btn-wide"
                            onClick={() => setShowMiniCart(false)}
                          >
                            Buka Checkout
                          </Link>
                        </div>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="desktop-only">
              <ThemeToggleButton onToggle={toggleTheme} isDark={isDark} />
            </div>

            {!isMobileViewport ? (
              <NavLink
                to="/admin"
                className={`header-iconAction${location.pathname.startsWith("/admin") ? " active" : ""}`}
                aria-label="Admin"
                title="Admin"
              >
                <Shield size={18} strokeWidth={2.1} />
              </NavLink>
            ) : null}

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
