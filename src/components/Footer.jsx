import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      {/* Top call-to-action bar */}
      <div className="container" style={{ marginTop: 18 }}>
        <div className="footer-topbar">
          <div>
            <div className="footer-topbarTitle">Cari akun premium? Biar aku bantu pilih paket yang pas.</div>
            <div className="footer-topbarSub">
              Browse produk, cek stok, lalu checkout. Kalau ragu, kamu bisa chat admin dulu.
            </div>
          </div>

          <div className="footer-topbarActions">
            <Link className="btn" to="/produk">Lihat Produk</Link>
            <a className="btn btn-ghost" href="https://wa.me/6283136049987" target="_blank" rel="noreferrer">
              Chat Admin
            </a>
          </div>
        </div>
      </div>

      <div className="container footer-grid">
        <div className="footer-col">
          <div className="footer-brandRow">
            <div className="footer-logo" aria-hidden="true">
              <img src="/imzaqistore_logo.png" alt="" />
            </div>
            <div>
              <div className="footer-brand">imzaqi.store</div>
              <div className="footer-desc">
                Hidden gem aplikasi premium murah, proses rapi, dan bergaransi.
              </div>
            </div>
          </div>

          <div className="footer-trust">
            <span>✅ Garansi</span>
            <span>⚡ Fast proses</span>
            <span>🔒 Aman</span>
          </div>

          <div className="footer-social" aria-label="Kontak cepat">
            <a href="https://wa.me/6283136049987" target="_blank" rel="noreferrer" aria-label="WhatsApp">
              💬
            </a>
            <Link to="/status" aria-label="Cek status order">
              📦
            </Link>
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
        </div>
      </div>

      <div className="footer-bottom">
        <div className="container">
          <div>© {year} imzaqi.store — All rights reserved.</div>
          <div className="footer-legal">Pembayaran via QRIS • Produk digital • Jam layanan mengikuti admin</div>
        </div>
      </div>
    </footer>
  );
}
