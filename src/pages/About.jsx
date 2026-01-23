import React from "react";

export default function About() {
  return (
    <div className="page">
      <section className="section reveal">
        <div className="container prose">
          <h1 className="h1">Tentang imzaqi-store</h1>
          <p className="muted">
            imzaqi-store adalah landing page katalog + checkout sederhana yang fokus ke pengalaman cepat:
            pilih paket → bayar QRIS → konfirmasi via WhatsApp.
          </p>

          <div className="prose-grid">
            <div className="prose-card">
              <h3>Cara beli</h3>
              <ol>
                <li>Buka halaman Produk, pilih paket dan klik + Keranjang.</li>
                <li>Masuk ke Checkout, terapkan kode promo bila ada.</li>
                <li>Scan QRIS dan lakukan pembayaran.</li>
                <li>Klik “Sudah bayar” untuk otomatis chat WhatsApp.</li>
              </ol>
            </div>
            <div className="prose-card">
              <h3>Garansi</h3>
              <p>
                Garansi mengikuti paket yang dipilih. Detail biasanya ada pada varian produk.
                Untuk pertanyaan, langsung chat WhatsApp setelah checkout.
              </p>
            </div>
            <div className="prose-card">
              <h3>Keamanan</h3>
              <p>
                Website menggunakan HTTPS dan data katalog disimpan aman.
                Tidak perlu login untuk berbelanja.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
