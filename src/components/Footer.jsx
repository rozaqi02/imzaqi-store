import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="site-footerPanel">
          <div className="site-footerTop">
            <div className="site-footerIntro">
              <div className="site-footerBadge">imzaqi.store</div>

              <div className="site-footerBrand">
                <img src="/imzaqistore_logo.png" alt="imzaqi.store" />
                <div>
                  <strong>Checkout yang cepat dan bersih.</strong>
                  <span>Produk digital, QRIS, dan status order dalam satu alur yang ringkas.</span>
                </div>
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

          <div className="site-footerMeta">
            <span>QRIS</span>
            <span>ID order</span>
            <span>Status</span>
            <span>Digital goods</span>
          </div>

          <div className="site-footerGrid">
            <div className="site-footerCol">
              <div className="site-footerLabel">Explore</div>
              <div className="site-footerList">
                <Link to="/">Home</Link>
                <Link to="/produk">Produk</Link>
                <Link to="/testimoni">Testimoni</Link>
              </div>
            </div>

            <div className="site-footerCol">
              <div className="site-footerLabel">Support</div>
              <div className="site-footerList">
                <Link to="/tentang">Tentang</Link>
                <Link to="/status">Cek status</Link>
                <a href="https://wa.me/6283136049987" target="_blank" rel="noreferrer">
                  Hubungi admin
                </a>
              </div>
            </div>

            <div className="site-footerCol">
              <div className="site-footerLabel">Kontak</div>
              <div className="site-footerList">
                <span>0831-3604-9987</span>
                <span>Pembayaran QRIS</span>
                <span>Fast mobile checkout</span>
              </div>
            </div>
          </div>

          <div className="site-footerBottom">
            <span>Copyright {year} imzaqi.store</span>
            <span>Built for fast mobile checkout.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
