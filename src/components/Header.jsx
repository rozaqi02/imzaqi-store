import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { createPortal } from "react-dom";
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

function MobileMenu({ open, onClose }) {
  if (!open) return null;

  return createPortal(
    <>
      <div className="mobile-backdrop" onClick={onClose} />

      <div className="mobile-menu">
        <NavLink to="/" onClick={onClose}>Home</NavLink>
        <NavLink to="/produk" onClick={onClose}>Produk</NavLink>
        <NavLink to="/tentang" onClick={onClose}>Tentang</NavLink>
        <NavLink to="/testimoni" onClick={onClose}>Testimoni</NavLink>
        <NavLink to="/status" onClick={onClose}>Status</NavLink>
        <NavLink to="/admin" onClick={onClose}>Admin</NavLink>
      </div>
    </>,
    document.body
  );
}

export default function Header() {
  const { items } = useCart();
  const cartCount = useMemo(() => items.reduce((s, x) => s + x.qty, 0), [items]);
  const [open, setOpen] = useState(false);

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

          {/* Desktop nav */}
          <nav className="nav desktop-only">
            <NavLink to="/">Home</NavLink>
            <NavLink to="/produk">Produk</NavLink>
            <NavLink to="/tentang">Tentang</NavLink>
            <NavLink to="/testimoni">Testimoni</NavLink>
            <NavLink to="/status">Status</NavLink>
            <NavLink to="/admin" className="nav-admin">Admin</NavLink>
          </nav>

          <div className="header-actions">
            <Link to="/checkout" className="header-cart">
              <CartIcon />
              {cartCount > 0 && <span className="pill">{cartCount}</span>}
            </Link>

            <button
              className="nav-toggle"
              onClick={() => setOpen(true)}
              aria-label="Buka menu"
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>

      {/* MOBILE SIDEBAR (PORTAL) */}
      <MobileMenu open={open} onClose={() => setOpen(false)} />
    </>
  );
}
