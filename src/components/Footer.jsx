import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="site-footerPanel">
          <div className="site-footerLead">
            <div className="site-footerBrand">
              <img src="/imzaqistore_logo.png" alt="imzaqi.store" />
              <div>
                <strong>imzaqi.store</strong>
                <span>QRIS, status, dan paket yang jelas.</span>
              </div>
            </div>

            <div className="site-footerActions">
              <Link className="btn" to="/produk">
                Produk
              </Link>
              <a className="btn btn-ghost" href="https://wa.me/6283136049987" target="_blank" rel="noreferrer">
                WhatsApp
              </a>
            </div>
          </div>

          <div className="site-footerGrid">
            <div className="site-footerCol">
              <div className="site-footerLabel">Store</div>
              <Link to="/">Home</Link>
              <Link to="/produk">Produk</Link>
              <Link to="/testimoni">Testimoni</Link>
            </div>

            <div className="site-footerCol">
              <div className="site-footerLabel">Bantuan</div>
              <Link to="/tentang">Tentang</Link>
              <Link to="/status">Cek status</Link>
              <a href="https://wa.me/6283136049987" target="_blank" rel="noreferrer">
                Hubungi admin
              </a>
            </div>

            <div className="site-footerCol">
              <div className="site-footerLabel">Kontak</div>
              <span>0831-3604-9987</span>
              <span>Pembayaran QRIS</span>
              <span>Produk digital</span>
            </div>
          </div>

          <div className="site-footerBottom">
            <span>© {year} imzaqi.store</span>
            <span>All rights reserved</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
