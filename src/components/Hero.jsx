import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { usePromo } from "../hooks/usePromo";
import { useVisitCount } from "../hooks/useVisitCount";

export default function Hero() {
  const { promo, apply, clear } = usePromo();
  const visitCount = useVisitCount();
  const [code, setCode] = useState(() => (promo?.code || ""));
  const [msg, setMsg] = useState("");

  useEffect(() => {
    // keep input synced when promo changes (and avoid crash if promo is null)
    const next = promo?.code || "";
    setCode((prev) => (prev ? prev : next));
  }, [promo]);


  async function onApply() {
    setMsg("");
    const res = await apply(code);
    setMsg(res.message);
  }

  return (
    <section className="hero">
      <div className="container hero-inner">
        <div className="hero-left">
          <div className="hero-kicker">Paket streaming & tools premium</div>
          <h1 className="hero-title">
            Pengalaman belanja cepat,
            <span className="hero-accent"> aman</span>, dan rapi.
          </h1>
          <p className="hero-sub">
            Pilih produk → checkout QRIS → klik “Sudah bayar” → otomatis diarahkan ke WhatsApp untuk proses aktivasi.
          </p>

          <div className="hero-ctas">
            <Link className="btn" to="/produk">Lihat Produk</Link>
            <Link className="btn btn-ghost" to="/checkout">Ke Checkout</Link>
          </div>

          <div className="hero-stats">
            <div className="stat">
              <div className="stat-num">{visitCount === null ? "…" : visitCount.toLocaleString("id-ID")}</div>
              <div className="stat-label">Kunjungan</div>
            </div>
            <div className="stat">
              <div className="stat-num">30%</div>
              <div className="stat-label">Diskon kode promo</div>
            </div>
            <div className="stat">
              <div className="stat-num">QRIS</div>
              <div className="stat-label">Checkout mudah</div>
            </div>
          </div>
        </div>

        <div className="hero-right">
          <div className="glass-card">
            <div className="glass-title">Klaim Kode Diskon</div>
            <div className="glass-sub">Diskon untuk pelanggan. Berlaku otomatis setelah kode diterapkan.</div>

            <div className="promo-row">
              <input
                className="input"
                placeholder="Masukkan kode (contoh: DISKON30)"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <button className="btn btn-sm" onClick={onApply}>Terapkan</button>
            </div>

            {promo.percent ? (
              <div className="promo-active">
                Aktif: <b>{promo.code}</b> ({promo.percent}%)
                <button className="link-btn" onClick={clear}>hapus</button>
              </div>
            ) : null}

            {msg ? <div className="hint">{msg}</div> : <div className="hint">Tips: Pilih paket di halaman Produk lalu lanjut ke Checkout.</div>}
          </div>

          <div className="hero-art" aria-hidden="true">
            <div className="orb o1" />
            <div className="orb o2" />
            <div className="orb o3" />
            <div className="grid-shine" />
          </div>
        </div>
      </div>
    </section>
  );
}
