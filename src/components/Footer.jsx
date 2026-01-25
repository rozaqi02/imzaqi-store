import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div className="footer-col">
          <div className="footer-brand">imzaqi.store</div>
          <div className="footer-desc">
            Hidden gem aplikasi premium murah, proses rapi, dan bergaransi.
          </div>

          <div className="footer-trust">
            <span>✅ Garansi</span>
            <span>⚡ Fast proses</span>
            <span>🔒 Aman</span>
          </div>
        </div>

        <div className="footer-col">
          <div className="footer-title">Menu</div>
          <Link to="/">Home</Link>
          <Link to="/produk">Produk</Link>
          <Link to="/testimoni">Testimoni</Link>
          <Link to="/tentang">Tentang</Link>
          <Link to="/status">Status Order</Link>
        </div>

        <div className="footer-col">
          <div className="footer-title">Bantuan</div>
          <Link to="/tentang">Cara order</Link>
          <Link to="/tentang">Syarat & ketentuan</Link>
          <Link to="/tentang">Kebijakan privasi</Link>
          <a href="https://wa.me/6283136049987" target="_blank" rel="noreferrer">
            Hubungi admin
          </a>
        </div>

        <div className="footer-col">
          <div className="footer-title">Kontak</div>
          <div className="footer-contact">WhatsApp: 0831-3604-9987</div>
          <div className="footer-contact">Email: admin@imzaqi.store</div>
          <div className="footer-contact">Indonesia</div>
        </div>
      </div>

      <div className="footer-bottom">
        © {year} imzaqi.store — All rights reserved.
      </div>
    </footer>
  );
}
