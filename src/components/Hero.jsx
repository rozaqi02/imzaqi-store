// Hero.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { fetchProducts } from "../lib/api";
import { useLiveStats } from "../hooks/useLiveStats";

const HERO_TEXT = "Hidden gem aplikasi premium murah + bergaransi loh yaa..";
const HIGHLIGHT = "murah + bergaransi";

// Konfigurasi Animasi Masuk (Fade Up)
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.62, ease: [0.22, 1, 0.36, 1] },
  }),
};

function renderTypedWithHighlight(typedText) {
  const start = HERO_TEXT.indexOf(HIGHLIGHT);
  if (start < 0) return typedText;

  const end = start + HIGHLIGHT.length;
  const n = typedText.length;

  if (n <= start) return typedText;

  if (n >= end) {
    return (
      <>
        {typedText.slice(0, start)}
        <span className="hero-highlight">{typedText.slice(start, end)}</span>
        {typedText.slice(end)}
      </>
    );
  }

  // sedang mengetik bagian highlight
  return (
    <>
      {typedText.slice(0, start)}
      <span className="hero-highlight">{typedText.slice(start)}</span>
    </>
  );
}

export default function Hero() {
  const nav = useNavigate();
  const { totalViews, todayViews, totalOrders, todayOrders } = useLiveStats();

  // Typewriter Logic
  const [typed, setTyped] = useState("");
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduce) {
      setTyped(HERO_TEXT);
      return;
    }
    let i = 0;
    const t = window.setInterval(() => {
      i += 1;
      setTyped(HERO_TEXT.slice(0, i));
      if (i >= HERO_TEXT.length) window.clearInterval(t);
    }, 28);
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
    return () => {
      alive = false;
    };
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

  // Subtle parallax for the 3D icon field (respects reduced motion)
  const heroRef = useRef(null);
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduce) return;

    function onMove(e) {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty("--px", String(x.toFixed(3)));
      el.style.setProperty("--py", String(y.toFixed(3)));
    }
    function onLeave() {
      el.style.setProperty("--px", "0");
      el.style.setProperty("--py", "0");
    }

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <section
      ref={heroRef}
      className="hero hero-center hero-premium full-bleed"
      style={{ position: "relative", overflow: "hidden" }}
    >
      <div className="container hero-center-inner">
        <motion.div custom={0} initial="hidden" animate="visible" variants={fadeUp} className="hero-kicker hero-kicker-premium">
          <span className="hero-dot" aria-hidden="true" />
          Digital subscription store
          <span className="hero-kicker-chip">QRIS • Garansi • Instant</span>
        </motion.div>

        <motion.h1 custom={1} initial="hidden" animate="visible" variants={fadeUp} className="hero-title hero-title-center hero-title-premium">
          <span className="typewriter">
            {renderTypedWithHighlight(typed)}
            <span className="cursor" aria-hidden="true" />
          </span>
        </motion.h1>

        <motion.p custom={2} initial="hidden" animate="visible" variants={fadeUp} className="hero-sub hero-sub-center hero-sub-premium">
          Cari produk favoritmu, pilih paketnya, lalu checkout QRIS. Bukti bayar bisa diupload langsung dari website—lebih cepat, lebih rapi, dan aman.
        </motion.p>

        <motion.div custom={3} initial="hidden" animate="visible" variants={fadeUp} className="hero-search hero-search-premium" ref={wrapRef} style={{ zIndex: 30 }}>
          <motion.div className="hero-search-shell" whileFocusWithin={{ scale: 1.01 }} transition={{ duration: 0.22 }}>
            <span className="hero-search-icon" aria-hidden="true">⌕</span>

            <input
              className="input hero-search-input hero-search-input-premium"
              placeholder="Cari Netflix / Canva / ChatGPT..."
              value={q}
              aria-label="Cari produk"
              onFocus={() => setOpen(true)}
              onChange={(e) => {
                setQ(e.target.value);
                setOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") goSearch();
                if (e.key === "Escape") setOpen(false);
              }}
            />

            {q && (
              <button
                type="button"
                className="hero-search-clear"
                onClick={() => {
                  setQ("");
                  setOpen(false);
                }}
                aria-label="Hapus pencarian"
              >
                ×
              </button>
            )}

            <button className="btn hero-search-btn hero-search-btn-premium" onClick={() => goSearch()} type="button">
              Cari
            </button>

            {open && suggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="suggestions suggestions-premium"
                role="listbox"
              >
                {suggestions.map((sug) => (
                  <button key={sug} className="suggestion-item" onClick={() => goSearch(sug)} type="button" role="option" aria-selected={false}>
                    {sug}
                  </button>
                ))}
              </motion.div>
            )}
          </motion.div>
        </motion.div>

        <motion.div custom={4} initial="hidden" animate="visible" variants={fadeUp} className="hero-ctas hero-ctas-center hero-ctas-premium">
          <Link className="btn btn-primary" to="/produk">Lihat Produk</Link>
          <Link className="btn btn-ghost" to="/checkout">Ke Checkout</Link>
        </motion.div>

        <motion.div
          className="hero-stats hero-stats-center hero-stats-premium"
          style={{ marginTop: 26 }}
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.08, delayChildren: 0.55 } } }}
        >
          {[
            { l: "Kunjungan total", v: totalViews },
            { l: "Kunjungan hari ini", v: todayViews },
            { l: "Order hari ini", v: todayOrders },
            { l: "Order total", v: totalOrders },
          ].map((item, idx) => (
            <motion.div
              key={idx}
              className="stat stat-premium"
              variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
              whileHover={{ y: -4 }}
            >
              <div className="stat-num">{item.v == null ? "—" : Number(item.v).toLocaleString("id-ID")}</div>
              <div className="stat-label">{item.l}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>

<div className="hero-art hero-art-premium" aria-hidden="true">
  <div className="hero-spotlight s1" />
  <div className="hero-spotlight s2" />
</div>

    </section>
  );
}
