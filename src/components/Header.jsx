import React, { useMemo, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useCart } from "../context/CartContext";

export default function Header() {
  const { items } = useCart();
  const cartCount = useMemo(() => items.reduce((s, x) => s + x.qty, 0), [items]);

  const [open, setOpen] = useState(false);

  return (
    <header className="header">
      <div className="container header-inner">
        <Link to="/" className="brand" onClick={() => setOpen(false)}>
          <div className="logo">i</div>
          <div className="brand-text">
            <div className="brand-name">imzaqi.store</div>
            <div className="brand-sub">Digital subscription store</div>
          </div>
        </Link>

        <button className="nav-toggle" onClick={() => setOpen(v => !v)} aria-label="Menu">
          <span />
          <span />
          <span />
        </button>

        <nav className={"nav " + (open ? "open" : "")}>
          <NavLink to="/" onClick={() => setOpen(false)} className={({ isActive }) => (isActive ? "active" : "")}>Home</NavLink>
          <NavLink to="/produk" onClick={() => setOpen(false)} className={({ isActive }) => (isActive ? "active" : "")}>Produk</NavLink>
          <NavLink to="/tentang" onClick={() => setOpen(false)} className={({ isActive }) => (isActive ? "active" : "")}>Tentang</NavLink>
          <NavLink to="/testimoni" onClick={() => setOpen(false)} className={({ isActive }) => (isActive ? "active" : "")}>Testimoni</NavLink>

          <Link to="/checkout" className="nav-cart" onClick={() => setOpen(false)}>
            Checkout <span className="pill">{cartCount}</span>
          </Link>

          <Link to="/admin" className="nav-admin" onClick={() => setOpen(false)}>
            Admin
          </Link>
        </nav>
      </div>
    </header>
  );
}
