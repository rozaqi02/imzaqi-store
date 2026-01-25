import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import LogoCloud from "./LogoCloud";
import { fetchProducts } from "../lib/api";
import { useLiveStats } from "../hooks/useLiveStats";

const HERO_TEXT = "Hidden Gem Aplikasi Premium Murah + Bergaransi Loh Ya :)";

export default function Hero() {
  const nav = useNavigate();

  const { totalViews, todayViews, totalOrders, todayOrders } = useLiveStats();

  // Typewriter
  const [typed, setTyped] = useState("");
  useEffect(() => {
    let i = 0;
    const t = window.setInterval(() => {
      i += 1;
      setTyped(HERO_TEXT.slice(0, i));
      if (i >= HERO_TEXT.length) window.clearInterval(t);
    }, 35);
    return () => window.clearInterval(t);
  }, []);

  // Search index (product + variants)
  const [index, setIndex] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await fetchProducts();
        if (!alive) return;

        const words = [];
        (data || []).forEach((p) => {
          if (p?.name) words.push(p.name);
          if (p?.slug) words.push(p.slug.replace(/-/g, " "));
          (p?.product_variants || []).forEach((v) => {
            if (v?.name) words.push(`${p.name} ${v.name}`);
            if (v?.duration_label) words.push(`${p.name} ${v.duration_label}`);
          });
        });

        const uniq = Array.from(new Set(words.map((x) => String(x).trim()).filter(Boolean)));
        setIndex(uniq);
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const suggestions = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return index
      .filter((x) => x.toLowerCase().includes(s))
      .slice(0, 8);
  }, [index, q]);

  useEffect(() => {
    function onDoc(e) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function goSearch(value) {
    const term = String(value || q || "").trim();
    if (!term) return;
    setOpen(false);
    nav(`/produk?q=${encodeURIComponent(term)}`);
  }

  return (
    <section className="hero hero-center">
      <div className="container hero-center-inner">
        <div className="hero-kicker">Digital subscription store</div>

        <h1 className="hero-title hero-title-center">
          <span className="typewriter">
            {typed}
            <span className="cursor" aria-hidden="true" />
          </span>
        </h1>

        <p className="hero-sub hero-sub-center">
          Cari produk favoritmu, pilih paketnya, lalu checkout QRIS. Bukti bayar bisa diupload langsung dari website.
        </p>

        <div className="hero-search" ref={wrapRef}>
          <input
            className="input hero-search-input"
            placeholder="Cari Netflix / Canva / Spotify / YouTube Premium..."
            value={q}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") goSearch();
            }}
          />

          <button className="btn hero-search-btn" onClick={() => goSearch()}>
            Cari
          </button>

          {open && suggestions.length > 0 ? (
            <div className="suggestions">
              {suggestions.map((sug) => (
                <button
                  key={sug}
                  className="suggestion-item"
                  onClick={() => goSearch(sug)}
                  type="button"
                >
                  {sug}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="hero-ctas hero-ctas-center">
          <Link className="btn" to="/produk">Lihat Produk</Link>
          <Link className="btn btn-ghost" to="/checkout">Ke Checkout</Link>
        </div>

        <div className="hero-stats hero-stats-center" style={{ marginTop: 18 }}>
          <div className="stat">
            <div className="stat-num">{totalViews == null ? "—" : Number(totalViews).toLocaleString("id-ID")}</div>
            <div className="stat-label">Kunjungan total</div>
          </div>
          <div className="stat">
            <div className="stat-num">{todayViews == null ? "—" : Number(todayViews).toLocaleString("id-ID")}</div>
            <div className="stat-label">Kunjungan hari ini</div>
          </div>
          <div className="stat">
            <div className="stat-num">{todayOrders == null ? "—" : Number(todayOrders).toLocaleString("id-ID")}</div>
            <div className="stat-label">Order hari ini</div>
          </div>
          <div className="stat">
            <div className="stat-num">{totalOrders == null ? "—" : Number(totalOrders).toLocaleString("id-ID")}</div>
            <div className="stat-label">Order total</div>
          </div>
        </div>
      </div>

      <div className="hero-art" aria-hidden="true">
        <div className="orb o1" />
        <div className="orb o2" />
        <div className="orb o3" />
        <div className="grid-shine" />
        <LogoCloud />
      </div>
    </section>
  );
}
