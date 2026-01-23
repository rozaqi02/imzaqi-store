import React from "react";
import "./App.css";
import Header from "./components/Header";
import ProductCard from "./components/ProductCard";
import Footer from "./components/Footer";
import products from "./data/products";

export default function App() {
  // GANTI ini dengan nomor WA kamu (format internasional tanpa +)
  const waNumber = "62812XXXXXXX";

  return (
    <div className="app">
      <Header />

      <main>
        <section className="hero">
          <div className="container hero-inner">
            <h1>Jualan paket streaming, rapi & cepat</h1>
            <p>
              Landing page sederhana untuk katalog produk + tombol beli via WhatsApp.
              Siap deploy ke Netlify dan dipasang ke domain imzaqi.store.
            </p>
            <div className="hero-cta">
              <a className="btn" href="#produk">Lihat Produk</a>
              <a className="btn secondary" href="#cara-beli">Cara Beli</a>
            </div>
            <div className="note">
              Catatan: pastikan produk yang kamu jual tidak melanggar kebijakan platform/layanan terkait.
            </div>
          </div>
        </section>

        <section id="produk" className="section">
          <div className="container">
            <h2>Produk</h2>
            <div className="grid">
              {products.map((p) => (
                <ProductCard key={p.id} item={p} waNumber={waNumber} />
              ))}
            </div>
          </div>
        </section>

        <section id="cara-beli" className="section alt">
          <div className="container">
            <h2>Cara Beli</h2>
            <ol className="steps">
              <li>Pilih paket yang kamu mau.</li>
              <li>Klik “Beli via WhatsApp”.</li>
              <li>Konfirmasi stok & metode pembayaran.</li>
              <li>Produk dikirim setelah pembayaran terverifikasi.</li>
            </ol>
          </div>
        </section>

        <section id="faq" className="section">
          <div className="container">
            <h2>FAQ</h2>
            <div className="faq">
              <div className="faq-item">
                <div className="q">Apakah ada garansi?</div>
                <div className="a">Tulis kebijakan garansi kamu di sini.</div>
              </div>
              <div className="faq-item">
                <div className="q">Metode pembayaran?</div>
                <div className="a">Misal: QRIS / Transfer bank / e-wallet.</div>
              </div>
              <div className="faq-item">
                <div className="q">Pengiriman berapa lama?</div>
                <div className="a">Sesuaikan: instan / 5-30 menit / jam operasional.</div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
