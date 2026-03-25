import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Grid2x2,
  House,
  Info,
  MessageSquareQuote,
  Shield,
  X,
} from "lucide-react";
import { useCart } from "../context/CartContext";

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

const menuItems = [
  { to: "/", label: "Home", icon: House },
  { to: "/produk", label: "Produk", icon: Grid2x2 },
  { to: "/tentang", label: "Tentang", icon: Info },
  { to: "/testimoni", label: "Testimoni", icon: MessageSquareQuote },
];

const secondaryItems = [
  { to: "/status", label: "Status", icon: Activity },
  { to: "/admin", label: "Admin", icon: Shield },
];

function MobileMenu({ open, onClose }) {
  const menuRef = useRef(null);
  const openRef = useRef(open);
  const location = useLocation();

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  useEffect(() => {
    if (openRef.current) {
      onClose();
    }
  }, [location.pathname, onClose]);

  useEffect(() => {
    if (open && menuRef.current) {
      const firstButton = menuRef.current.querySelector("button");
      firstButton?.focus();
    }
  }, [open]);

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
    },
    exit: {
      opacity: 0,
      transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
    },
  };

  const menuVariants = {
    hidden: {
      x: "100%",
      opacity: 0,
    },
    visible: {
      x: 0,
      opacity: 1,
      transition: {
        type: "spring",
        damping: 30,
        stiffness: 300,
        mass: 0.8,
      },
    },
    exit: {
      x: "100%",
      opacity: 0,
      transition: {
        type: "spring",
        damping: 30,
        stiffness: 300,
        mass: 0.8,
      },
    },
  };

  const headerVariants = {
    hidden: { opacity: 0, y: -10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { delay: 0.15, duration: 0.3 },
    },
    exit: { opacity: 0, y: -10, transition: { duration: 0.15 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: (i) => ({
      opacity: 1,
      x: 0,
      transition: {
        delay: 0.1 + i * 0.05,
        duration: 0.3,
        ease: [0.16, 1, 0.3, 1],
      },
    }),
    exit: {
      opacity: 0,
      x: 20,
      transition: { duration: 0.15 },
    },
  };

  const closeButtonVariants = {
    hidden: { scale: 0, rotate: -90 },
    visible: {
      scale: 1,
      rotate: 0,
      transition: {
        type: "spring",
        damping: 15,
        stiffness: 300,
        delay: 0.2,
      },
    },
    exit: {
      scale: 0,
      rotate: 90,
      transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
    },
  };

  return createPortal(
    <AnimatePresence mode="wait">
      {open ? (
        <>
          <motion.div
            className="mobile-backdrop"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.nav
            ref={menuRef}
            className="mobile-menu"
            variants={menuVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(e, { offset, velocity }) => {
              if (offset.x > 100 || velocity.x > 500) {
                onClose();
              }
            }}
            role="navigation"
            aria-label="Menu navigasi mobile"
          >
            <motion.button
              className="mobile-menu-close"
              onClick={onClose}
              aria-label="Tutup menu"
              variants={closeButtonVariants}
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
            >
              <X size={18} strokeWidth={2.2} />
            </motion.button>

            <motion.div className="mobile-menu-header" variants={headerVariants}>
              <h3>Menu</h3>
              <p>Navigasi Cepat</p>
            </motion.div>

            {menuItems.map((item, i) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to;

              return (
                <motion.div key={item.to} custom={i} variants={itemVariants}>
                  <NavLink to={item.to} className={isActive ? "active" : ""}>
                    <motion.span
                      className="menu-icon"
                      whileHover={{ scale: 1.2, rotate: 5 }}
                      transition={{ type: "spring", stiffness: 400, damping: 10 }}
                    >
                      <Icon size={18} strokeWidth={2.1} />
                    </motion.span>
                    <span>{item.label}</span>
                    {isActive ? (
                      <motion.span
                        className="active-indicator"
                        layoutId="activeIndicator"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    ) : null}
                  </NavLink>
                </motion.div>
              );
            })}

            <motion.div className="mobile-menu-divider" custom={menuItems.length} variants={itemVariants} />

            {secondaryItems.map((item, i) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to;
              const customIndex = menuItems.length + 1 + i;

              return (
                <motion.div key={item.to} custom={customIndex} variants={itemVariants}>
                  <NavLink to={item.to} className={isActive ? "active" : ""}>
                    <motion.span
                      className="menu-icon"
                      whileHover={{ scale: 1.2, rotate: 5 }}
                      transition={{ type: "spring", stiffness: 400, damping: 10 }}
                    >
                      <Icon size={18} strokeWidth={2.1} />
                    </motion.span>
                    <span>{item.label}</span>
                    {isActive ? (
                      <motion.span
                        className="active-indicator"
                        layoutId="activeIndicator"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    ) : null}
                  </NavLink>
                </motion.div>
              );
            })}

            <motion.div
              className="mobile-menu-footer"
              custom={menuItems.length + secondaryItems.length + 2}
              variants={itemVariants}
            >
              <p className="menu-footer-text">imzaqi.store</p>
              <p className="menu-footer-version">v3.1</p>
            </motion.div>
          </motion.nav>
        </>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

export default function Header() {
  const { items } = useCart();
  const cartCount = useMemo(() => items.reduce((s, x) => s + x.qty, 0), [items]);
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const handleOpen = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);

  useEffect(() => {
    document.body.classList.toggle("nav-open", open);
    return () => document.body.classList.remove("nav-open");
  }, [open]);

  return (
    <>
      <header className="header">
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
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link to="/checkout" state={{ backgroundLocation: location }} className="header-cart">
                <CartIcon />
                {cartCount > 0 ? (
                  <motion.span
                    className="pill"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 15 }}
                  >
                    {cartCount}
                  </motion.span>
                ) : null}
              </Link>
            </motion.div>

            <motion.div
              className="desktop-only"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <NavLink
                to="/admin"
                className={`header-iconAction${location.pathname.startsWith("/admin") ? " active" : ""}`}
                aria-label="Admin"
                title="Admin"
              >
                <Shield size={18} strokeWidth={2.1} />
              </NavLink>
            </motion.div>

            <motion.button
              className="nav-toggle"
              onClick={handleOpen}
              aria-label="Buka menu"
              aria-expanded={open}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <motion.span
                animate={open ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
                transition={{ duration: 0.2 }}
              />
              <motion.span
                animate={open ? { opacity: 0 } : { opacity: 1 }}
                transition={{ duration: 0.2 }}
              />
              <motion.span
                animate={open ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }}
                transition={{ duration: 0.2 }}
              />
            </motion.button>
          </div>
        </div>
      </header>

      <MobileMenu open={open} onClose={handleClose} />
    </>
  );
}
