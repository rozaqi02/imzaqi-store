import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Search } from "lucide-react";
import { useLiveStats } from "../hooks/useLiveStats";
import NumberCounter from "./NumberCounter";

/* ── Opsi C: Split Bold ──────────────────────────────────────────────────
   Desktop: judul sangat besar di kiri (tiap baris sendiri),
            4 stat card 2×2 di kanan.
   Mobile:  judul besar full-width, lalu 4 stat card 2×2 di bawah copy.
   ─────────────────────────────────────────────────────────────────────── */

export default function Hero({ products = [] }) {
  const nav = useNavigate();
  const { totalViews, todayViews, totalOrders, weekOrders } = useLiveStats({ intervalMs: 60000 });

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [prefersReduced, setPrefersReduced] = useState(false);
  const wrapRef = useRef(null);
  const listboxId = "hero-search-listbox";

  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReduced(mq.matches);
    const h = () => setPrefersReduced(mq.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  useEffect(() => {
    if (!q.trim()) { setSuggestions([]); return; }
    const s = q.trim().toLowerCase();
    const words = [];
    (products || []).forEach((p) => {
      if (p?.name) words.push(p.name);
      (p?.product_variants || []).forEach((v) => {
        if (v?.name) words.push(`${p.name} – ${v.name}`);
      });
    });
    const unique = Array.from(new Set(words.map((w) => String(w).trim()).filter(Boolean)));
    setSuggestions(unique.filter((x) => x.toLowerCase().includes(s)).slice(0, 5));
  }, [q, products]);

  useEffect(() => {
    if (activeSuggestionIndex >= suggestions.length) setActiveSuggestionIndex(-1);
  }, [activeSuggestionIndex, suggestions.length]);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setActiveSuggestionIndex(-1);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function goSearch(value) {
    const term = String(value || q || "").trim();
    if (!term) return;
    setOpen(false);
    setActiveSuggestionIndex(-1);
    nav(`/produk?q=${encodeURIComponent(term)}`);
  }

  const fade = (delay = 0) =>
    prefersReduced
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] },
        };

  const STATS = [
    { value: totalOrders,  label: "Total order",      accent: true  },
    { value: weekOrders,   label: "Minggu ini",        accent: false },
    { value: totalViews,   label: "Total kunjungan",   accent: false },
    { value: todayViews,   label: "Hari ini",          accent: false },
  ];

  return (
    <section className="hc full-bleed" aria-label="Selamat datang di Imzaqi Store">
      <div className="container hc-layout">

        {/* ── Kiri: judul besar + search + CTA ── */}
        <div className="hc-copy">
          <motion.p className="hc-kicker" {...fade(0)}>
            Langganan digital · Bayar QRIS
          </motion.p>

          <motion.h1 className="hc-title" {...fade(0.06)}>
            <span className="hc-title-line">Akses</span>
            <span className="hc-title-line">premium.</span>
            <span className="hc-title-line hc-title-line--accent">Harga</span>
            <span className="hc-title-line hc-title-line--accent">pelajar.</span>
          </motion.h1>

          <motion.p className="hc-sub" {...fade(0.16)}>
            Netflix, Spotify, Canva, ChatGPT — semua ada.
            Pilih paket, bayar QRIS, langsung aktif.
          </motion.p>

          {/* Search */}
          <motion.div className="hc-search" ref={wrapRef} {...fade(0.22)}>
            <div className="hero-search-shell">
              <span className="hero-search-icon" aria-hidden="true">
                <Search size={16} />
              </span>
              <input
                className="input hero-search-input"
                placeholder="Cari Netflix, Spotify, Canva…"
                value={q}
                aria-label="Cari produk"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={open && suggestions.length > 0}
                aria-controls={open && suggestions.length > 0 ? listboxId : undefined}
                aria-activedescendant={
                  activeSuggestionIndex >= 0
                    ? `${listboxId}-option-${activeSuggestionIndex}`
                    : undefined
                }
                onFocus={() => setOpen(true)}
                onChange={(e) => { setQ(e.target.value); setOpen(true); setActiveSuggestionIndex(-1); }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown" && suggestions.length > 0) {
                    e.preventDefault(); setOpen(true);
                    setActiveSuggestionIndex((p) => p >= suggestions.length - 1 ? 0 : p + 1);
                    return;
                  }
                  if (e.key === "ArrowUp" && suggestions.length > 0) {
                    e.preventDefault(); setOpen(true);
                    setActiveSuggestionIndex((p) => p <= 0 ? suggestions.length - 1 : p - 1);
                    return;
                  }
                  if (e.key === "Enter") {
                    if (open && activeSuggestionIndex >= 0 && suggestions[activeSuggestionIndex]) {
                      e.preventDefault(); goSearch(suggestions[activeSuggestionIndex]); return;
                    }
                    e.preventDefault(); goSearch();
                  }
                  if (e.key === "Escape") { setOpen(false); setActiveSuggestionIndex(-1); }
                }}
              />
              {q ? (
                <button type="button" className="hero-search-clear"
                  onClick={() => { setQ(""); setOpen(false); setActiveSuggestionIndex(-1); }}
                  aria-label="Hapus pencarian">×</button>
              ) : null}
              <button className="btn hero-search-btn" onClick={() => goSearch()} type="button" aria-label="Cari">
                <ArrowRight size={16} />
              </button>
              {open && suggestions.length > 0 ? (
                <div className="suggestions suggestions-minimal" role="listbox" id={listboxId}>
                  {suggestions.map((sug, idx) => (
                    <button
                      key={sug}
                      id={`${listboxId}-option-${idx}`}
                      className={`suggestion-item${idx === activeSuggestionIndex ? " is-active" : ""}`}
                      onClick={() => goSearch(sug)}
                      onMouseEnter={() => setActiveSuggestionIndex(idx)}
                      type="button" role="option" aria-selected={idx === activeSuggestionIndex}
                    >
                      <Search size={13} /><span>{sug}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </motion.div>


        </div>

        {/* ── Kanan: 4 stat card 2×2 ── */}
        <motion.aside className="hc-stats" aria-label="Statistik toko" {...fade(0.1)}>
          <div className="hc-statsGrid">
            {STATS.map((s, i) => (
              <motion.div
                key={s.label}
                className={`hc-statCard${s.accent ? " hc-statCard--accent" : ""}`}
                {...(prefersReduced ? {} : {
                  initial: { opacity: 0, scale: 0.92 },
                  animate: { opacity: 1, scale: 1 },
                  transition: { duration: 0.45, delay: 0.12 + i * 0.06, ease: [0.22, 1, 0.36, 1] },
                })}
              >
                <span className="hc-statNum">
                  {s.value == null ? "—" : <NumberCounter value={s.value} />}
                </span>
                <span className="hc-statLabel">{s.label}</span>
              </motion.div>
            ))}
          </div>

          <p className="hc-trust">
            <span className="hc-trustDot" aria-hidden="true" />
            Bayar QRIS · Proses cepat
          </p>
        </motion.aside>

      </div>
    </section>
  );
}
