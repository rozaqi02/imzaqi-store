import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-left">
          <div className="footer-brand">imzaqi-store</div>
          <div className="footer-muted">© {year}. Hak cipta dilindungi.</div>
        </div>
        <div className="footer-links">
          <Link to="/tentang">Tentang</Link>
          <Link to="/produk">Produk</Link>
          <Link to="/testimoni">Testimoni</Link>
        </div>
      </div>
    </footer>
  );
}
