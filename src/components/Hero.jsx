import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion"; // Import Animation Library
import LogoCloud from "./LogoCloud";
import { fetchProducts } from "../lib/api";
import { useLiveStats } from "../hooks/useLiveStats";

const HERO_TEXT = "Hidden Gem Aplikasi Premium Murah + Bergaransi Loh Ya :)";

// Konfigurasi Animasi Masuk (Fade Up)
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }
  })
};

export default function Hero() {
  const nav = useNavigate();
  const { totalViews, todayViews, totalOrders, todayOrders } = useLiveStats();

  // Typewriter Logic
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

  // Search Logic
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
          });
        });
        setIndex(Array.from(new Set(words.map((x) => String(x).trim()).filter(Boolean))));
      } catch {}
    })();
    return () => { alive = false; };
  }, []);

  const suggestions = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return index.filter((x) => x.toLowerCase().includes(s)).slice(0, 8);
  }, [index, q]);

  useEffect(() => {
    function onDoc(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
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
    <section className="hero hero-center" style={{ position: "relative", overflow: "hidden" }}>
      <div className="container hero-center-inner">
        
        {/* Animated Badge */}
        <motion.div 
          custom={0} initial="hidden" animate="visible" variants={fadeUp}
          className="hero-kicker"
        >
          Digital subscription store
        </motion.div>

        {/* Title */}
        <motion.h1 
          custom={1} initial="hidden" animate="visible" variants={fadeUp}
          className="hero-title hero-title-center"
        >
          <span className="typewriter">
            {typed}
            <span className="cursor" aria-hidden="true" />
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p 
          custom={2} initial="hidden" animate="visible" variants={fadeUp}
          className="hero-sub hero-sub-center"
        >
          Cari produk favoritmu, pilih paketnya, lalu checkout QRIS. Bukti bayar bisa diupload langsung dari website.
        </motion.p>

        {/* Search Bar Interactive */}
        <motion.div 
          custom={3} initial="hidden" animate="visible" variants={fadeUp}
          className="hero-search" ref={wrapRef}
          style={{ zIndex: 30 }}
        >
          <motion.div 
            style={{ width: '100%', display:'flex', gap: 10, position:'relative' }}
            whileFocusWithin={{ scale: 1.02 }} // Efek membesar saat fokus
            transition={{ duration: 0.3 }}
          >
            <input
              className="input hero-search-input"
              placeholder="Cari Netflix / Canva / Spotify..."
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

            {/* Suggestions Dropdown */}
            {open && suggestions.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="suggestions"
              >
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
              </motion.div>
            )}
          </motion.div>
        </motion.div>

        {/* Buttons */}
        <motion.div 
          custom={4} initial="hidden" animate="visible" variants={fadeUp}
          className="hero-ctas hero-ctas-center"
        >
          <Link className="btn" to="/produk">Lihat Produk</Link>
          <Link className="btn btn-ghost" to="/checkout">Ke Checkout</Link>
        </motion.div>

        {/* Live Stats */}
        <motion.div 
          className="hero-stats hero-stats-center" style={{ marginTop: 24 }}
          initial="hidden" animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.1, delayChildren: 0.6 } }
          }}
        >
          {[
            { l: "Kunjungan total", v: totalViews },
            { l: "Kunjungan hari ini", v: todayViews },
            { l: "Order hari ini", v: todayOrders },
            { l: "Order total", v: totalOrders }
          ].map((item, idx) => (
            <motion.div 
              key={idx} 
              className="stat"
              variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
              whileHover={{ y: -5, backgroundColor: "rgba(255,255,255,0.06)" }}
            >
              <div className="stat-num">{item.v == null ? "—" : Number(item.v).toLocaleString("id-ID")}</div>
              <div className="stat-label">{item.l}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Animated Background Orbs */}
      <div className="hero-art" aria-hidden="true">
        <motion.div 
          className="orb o1"
          animate={{ y: [0, -20, 0], x: [0, 10, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="orb o2"
          animate={{ y: [0, 30, 0], x: [0, -15, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
        <motion.div 
          className="orb o3"
          animate={{ y: [0, -25, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
        <div className="grid-shine" />
        <LogoCloud />
      </div>
    </section>
  );
}