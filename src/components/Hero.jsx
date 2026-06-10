import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Eye,
  Package,
  Search,
  ShieldCheck,
  ShoppingBag,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useLiveStats } from "../hooks/useLiveStats";
import NumberCounter from "./NumberCounter";
import { TodayPulseIcon } from "./HeroStatIcons";

const TRUST_PILLS = [
  { icon: ShieldCheck, label: "Garansi aman" },
  { icon: Zap, label: "Proses kilat" },
  { icon: TrendingUp, label: "Harga pelajar" },
];

export default function Hero({ products = [] }) {
  const nav = useNavigate();
  const { last7DaysViews, totalOrders, todayOrders } = useLiveStats({ intervalMs: 60000 });

  const activeProductCount = useMemo(
    () =>
      (products || []).filter((product) =>
        (product?.product_variants || []).some((variant) => variant?.is_active)
      ).length,
    [products]
  );

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
    if (!q.trim()) {
      setSuggestions([]);
      return;
    }
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
          initial: { opacity: 0, y: 20 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] },
        };

  return (
    <section className="hm-hero" aria-label="Marketplace Hero">
      <div className="hm-hero-bg" aria-hidden="true">
        <div className="hm-hero-orb hm-hero-orb--1" />
        <div className="hm-hero-orb hm-hero-orb--2" />
        <div className="hm-hero-orb hm-hero-orb--3" />
        <div className="hm-hero-grid" />
      </div>

      <div className="container hm-container">
        <motion.div className="hm-stage-copy" {...fade(0)}>
          <h1 className="hm-main-title">
            Akses <span className="hm-title-accent">Premium</span>.
            <br />
            Harga <span className="hm-title-glow">Pelajar</span>.
          </h1>

          <p className="hm-subtitle">
            Netflix, Spotify, Canva, dan lainnya — harga ramah dompet, bayar QRIS, langsung diproses.
          </p>

          <div className="hm-search-container" ref={wrapRef}>
            <div className="hero-search-shell hm-search-shell">
              <span className="hero-search-icon" aria-hidden="true">
                <Search size={18} />
              </span>
              <input
                className="input hero-search-input"
                placeholder="Mau cari apa? Netflix, Spotify, Canva..."
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
                onChange={(e) => {
                  setQ(e.target.value);
                  setOpen(true);
                  setActiveSuggestionIndex(-1);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown" && suggestions.length > 0) {
                    e.preventDefault();
                    setOpen(true);
                    setActiveSuggestionIndex((p) => (p >= suggestions.length - 1 ? 0 : p + 1));
                    return;
                  }
                  if (e.key === "ArrowUp" && suggestions.length > 0) {
                    e.preventDefault();
                    setOpen(true);
                    setActiveSuggestionIndex((p) => (p <= 0 ? suggestions.length - 1 : p - 1));
                    return;
                  }
                  if (e.key === "Enter") {
                    if (open && activeSuggestionIndex >= 0 && suggestions[activeSuggestionIndex]) {
                      e.preventDefault();
                      goSearch(suggestions[activeSuggestionIndex]);
                      return;
                    }
                    e.preventDefault();
                    goSearch();
                  }
                  if (e.key === "Escape") {
                    setOpen(false);
                    setActiveSuggestionIndex(-1);
                  }
                }}
              />
              {q ? (
                <button
                  type="button"
                  className="hero-search-clear"
                  onClick={() => {
                    setQ("");
                    setOpen(false);
                    setActiveSuggestionIndex(-1);
                  }}
                  aria-label="Hapus pencarian"
                >
                  ×
                </button>
              ) : null}
              <button className="btn hero-search-btn hm-search-submit" onClick={() => goSearch()} type="button" aria-label="Cari">
                <span className="hm-search-submit-text">Cari</span>
                <ArrowRight size={16} />
              </button>
            </div>
            {open && suggestions.length > 0 ? (
              <div
                className="suggestions suggestions-minimal suggestions--animate"
                role="listbox"
                id={listboxId}
              >
                {suggestions.map((sug, idx) => (
                  <button
                    key={sug}
                    id={`${listboxId}-option-${idx}`}
                    className={`suggestion-item${idx === activeSuggestionIndex ? " is-active" : ""}`}
                    style={{ "--suggest-i": idx }}
                    onClick={() => goSearch(sug)}
                    onMouseEnter={() => setActiveSuggestionIndex(idx)}
                    type="button"
                    role="option"
                    aria-selected={idx === activeSuggestionIndex}
                  >
                    <Search size={13} />
                    <span>{sug}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="hm-action-row">
            <div className="hm-cta-row">
              <Link className="btn" to="/produk">
                Lihat Katalog
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link className="btn btn-ghost" to="/status">
                Cek Status
              </Link>
            </div>

            <div className="hm-trust-rail" aria-label="Keunggulan toko">
              {TRUST_PILLS.map((pill) => {
                const Icon = pill.icon;
                return (
                  <span key={pill.label} className="hm-trust-pill">
                    <Icon size={13} aria-hidden="true" />
                    {pill.label}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="hm-stats-grid" role="list" aria-label="Statistik toko">
            <div className="hm-stat-chip" role="listitem">
              <span className="hm-stat-chip-icon" aria-hidden="true">
                <ShoppingBag size={14} />
              </span>
              <span className="hm-stat-chip-value">
                <NumberCounter value={totalOrders || 0} />
              </span>
              <span className="hm-stat-chip-label">Pesanan</span>
            </div>
            <div className="hm-stat-chip hm-stat-chip--today" role="listitem">
              <span className="hm-stat-chip-icon hm-stat-chip-icon--today" aria-hidden="true">
                <TodayPulseIcon size={15} />
              </span>
              <span className="hm-stat-chip-value">
                <NumberCounter value={todayOrders || 0} />
              </span>
              <span className="hm-stat-chip-label">Hari ini</span>
            </div>
            <div className="hm-stat-chip" role="listitem">
              <span className="hm-stat-chip-icon" aria-hidden="true">
                <Package size={14} />
              </span>
              <span className="hm-stat-chip-value">
                <NumberCounter value={activeProductCount} />
              </span>
              <span className="hm-stat-chip-label">Produk</span>
            </div>
            <div className="hm-stat-chip" role="listitem">
              <span className="hm-stat-chip-icon" aria-hidden="true">
                <Eye size={14} />
              </span>
              <span className="hm-stat-chip-value">
                <NumberCounter value={last7DaysViews || 0} />
              </span>
              <span className="hm-stat-chip-label">7 hari</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}