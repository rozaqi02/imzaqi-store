import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Eye,
  Flame,
  Package,
  Search,
  ShieldCheck,
  ShoppingBag,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useLiveStats } from "../hooks/useLiveStats";
import NumberCounter from "./NumberCounter";

const TRUST_PILLS = [
  { icon: ShieldCheck, label: "Garansi aman" },
  { icon: Zap, label: "Proses kilat" },
  { icon: TrendingUp, label: "Harga pelajar" },
];

const SEARCH_QUERIES = ["Netflix Premium", "Spotify Family", "YouTube Premium", "Canva Pro", "ChatGPT", "Disney+ Hotstar"];

function useTypewriter(words) {
  const [text, setText] = useState("Ketik nama produk..");

  useEffect(() => {
    let wordIdx = 0;
    let charIdx = 0;
    let deleting = false;
    let timer;

    // Natural typing: random delay per karakter agar terasa lebih human
    const naturalDelay = () => 55 + Math.random() * 65;

    const tick = () => {
      const word = words[wordIdx];
      if (deleting) {
        charIdx--;
        setText(`Ketik "${word.slice(0, charIdx)}"`);
        // Menghapus lebih cepat dari mengetik
        timer = setTimeout(tick, charIdx === 0 ? 480 : 38);
        if (charIdx === 0) {
          deleting = false;
          wordIdx = (wordIdx + 1) % words.length;
        }
      } else {
        charIdx++;
        setText(`Ketik "${word.slice(0, charIdx)}"`);
        if (charIdx === word.length) {
          deleting = true;
          // Pause lebih lama setelah kata selesai
          timer = setTimeout(tick, 1600 + Math.random() * 400);
        } else {
          // Random delay per karakter untuk natural feel
          const delay = naturalDelay();
          timer = setTimeout(tick, delay);
        }
      }
    };

    timer = setTimeout(tick, 1200);
    return () => clearTimeout(timer);
  }, [words]);

  return text;
}

function HeroSearch({ products = [] }) {
  const nav = useNavigate();
  const wrapRef = useRef(null);
  const listboxId = "hero-search-listbox";

  const placeholderText = useTypewriter(SEARCH_QUERIES);

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  const suggestions = useMemo(() => {
    if (!q.trim()) return [];
    const s = q.trim().toLowerCase();
    const words = [];
    (products || []).forEach((p) => {
      if (p?.name) words.push(p.name);
      (p?.product_variants || []).forEach((v) => {
        if (v?.name) words.push(`${p.name} \u2013 ${v.name}`);
      });
    });
    return Array.from(new Set(words.filter(Boolean)))
      .filter((x) => x.toLowerCase().includes(s))
      .slice(0, 5);
  }, [q, products]);

  useEffect(() => {
    if (activeIdx >= suggestions.length) setActiveIdx(-1);
  }, [activeIdx, suggestions.length]);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setActiveIdx(-1);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function goSearch(value) {
    const term = String(value || q || "").trim();
    if (!term) return;
    setOpen(false);
    setActiveIdx(-1);
    nav(`/produk?q=${encodeURIComponent(term)}`);
  }

  return (
    <div className="hm-search-container" ref={wrapRef}>
      <div className="hero-search-shell hm-search-shell">
        <span className="hero-search-icon" aria-hidden="true">
          <Search size={18} />
        </span>
        <input
          className="input hero-search-input"
          placeholder={placeholderText}
          value={q}
          aria-label="Cari produk"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && suggestions.length > 0}
          aria-controls={open && suggestions.length > 0 ? listboxId : undefined}
          aria-activedescendant={
            activeIdx >= 0 ? `${listboxId}-option-${activeIdx}` : undefined
          }
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActiveIdx(-1);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && suggestions.length > 0) {
              e.preventDefault();
              setOpen(true);
              setActiveIdx((p) => (p >= suggestions.length - 1 ? 0 : p + 1));
              return;
            }
            if (e.key === "ArrowUp" && suggestions.length > 0) {
              e.preventDefault();
              setOpen(true);
              setActiveIdx((p) => (p <= 0 ? suggestions.length - 1 : p - 1));
              return;
            }
            if (e.key === "Enter") {
              if (open && activeIdx >= 0 && suggestions[activeIdx]) {
                e.preventDefault();
                goSearch(suggestions[activeIdx]);
                return;
              }
              e.preventDefault();
              goSearch();
            }
            if (e.key === "Escape") {
              setOpen(false);
              setActiveIdx(-1);
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
              setActiveIdx(-1);
            }}
            aria-label="Hapus pencarian"
          >
            ×
          </button>
        ) : null}
        <button
          className="btn hero-search-btn hm-search-submit"
          onClick={() => goSearch()}
          type="button"
          aria-label="Cari"
        >
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
              className={`suggestion-item${idx === activeIdx ? " is-active" : ""}`}
              style={{ "--suggest-i": idx }}
              onClick={() => goSearch(sug)}
              onMouseEnter={() => setActiveIdx(idx)}
              type="button"
              role="option"
              aria-selected={idx === activeIdx}
            >
              <Search size={13} />
              <span>{sug}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function Hero({ products = [] }) {
  const { last7DaysViews, totalOrders, todayOrders } = useLiveStats({ intervalMs: 60000 });
  const [prefersReduced, setPrefersReduced] = useState(false);

  const activeProductCount = useMemo(
    () =>
      (products || []).filter((p) =>
        (p?.product_variants || []).some((v) => v?.is_active)
      ).length,
    [products]
  );

  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReduced(mq.matches);
    const h = () => setPrefersReduced(mq.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  const fadeUp = prefersReduced
    ? {}
    : {
        initial: { opacity: 0, y: 18 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
      };

  return (
    <section className="hm-hero" aria-label="Marketplace Hero">
      {/* Static gradient bg — no animation to avoid compositor thrash */}
      <div className="hm-hero-bg" aria-hidden="true">
        <div className="hm-hero-grid" />
      </div>

      <div className="container hm-container">
        <motion.div className="hm-stage-copy" {...fadeUp}>
          {/* Headline */}
          <h1 className="hm-main-title">
            Akses <span className="hm-title-accent">Premium</span>.
            <br />
            Harga <span className="hm-title-glow">Pelajar</span>.
          </h1>

          {/* Subtitle */}
          <p className="hm-subtitle">
            {activeProductCount > 0
              ? `${activeProductCount}+ produk digital premium — bayar QRIS, aktif dalam menit.`
              : "Netflix, Spotify, Canva, dan lainnya — bayar QRIS, aktif dalam menit."}
          </p>

          {/* Isolated Search Component */}
          <HeroSearch products={products} />

          {/* CTA row */}
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

          {/* Stats — dengan stagger animation per chip */}
          <div className="hm-stats-grid" role="list" aria-label="Statistik toko">
            {[
              { icon: ShoppingBag, value: totalOrders || 0, label: "Pesanan", ctx: "sejak 2024", extra: "" },
              { icon: Flame, value: todayOrders || 0, label: "Hari ini", ctx: "order masuk", extra: "hm-stat-chip--today", iconExtra: "hm-stat-chip-icon--today" },
              { icon: Package, value: activeProductCount, label: "Produk", ctx: "aktif tersedia", extra: "" },
              { icon: Eye, value: last7DaysViews || 0, label: "7 hari", ctx: "kunjungan", extra: "" },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className={`hm-stat-chip${stat.extra ? ` ${stat.extra}` : ""}`}
                role="listitem"
                style={{ "--chip-i": i }}
              >
                <span className={`hm-stat-chip-icon${stat.iconExtra ? ` ${stat.iconExtra}` : ""}`} aria-hidden="true">
                  <stat.icon size={14} />
                </span>
                <span className="hm-stat-chip-value">
                  <NumberCounter value={stat.value} />
                </span>
                <span className="hm-stat-chip-label">{stat.label}</span>
                <span className="hm-stat-chip-ctx">{stat.ctx}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
