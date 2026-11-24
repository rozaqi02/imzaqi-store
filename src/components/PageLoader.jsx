import React, { useState } from "react";

const LOADER_QUOTES = [
  "Nyiapin yang terbaik buat kamu...",
  "Stok fresh, harga pelajar.",
  "Sebentar ya, lagi ngambil dari gudang...",
  "Premium terjangkau, bukan mimpi.",
  "Muat sebentar, worth the wait!",
  "Loading... tapi cepet kok.",
  "Akun ready, tinggal checkout.",
];

export default function PageLoader() {
  const [quoteIdx] = useState(() => Math.floor(Math.random() * LOADER_QUOTES.length));
  const quote = LOADER_QUOTES[quoteIdx];

  return (
    <div className="page-loader" aria-label="Memuat halaman" role="status">
      <div className="page-loader-inner">
        <img
          className="page-loader-logo"
          src="/icon.png"
          alt="imzaqi.store"
          width="44"
          height="44"
        />
        <div className="page-loader-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p className="page-loader-quote">{quote}</p>
      </div>
    </div>
  );
}
