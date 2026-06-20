import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Eye,
  Flame,
  Package,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  X,
  Zap,
} from "lucide-react";
import { useLiveStats } from "../hooks/useLiveStats";
import NumberCounter from "./NumberCounter";
import { supabase } from "../lib/supabaseClient";
import TypewriterSearchInput from "./TypewriterSearchInput";

/* ── Data ── */
const TRUST_ITEMS = [
  { icon: ShieldCheck, label: "Garansi Replace" },
  { icon: Zap, label: "Instan 5 Menit" },
  { icon: Star, label: "Harga Pelajar" },
];

const SEARCH_QUERIES = [
  "Netflix Premium",
  "Spotify Family",
  "YouTube Premium",
  "Canva Pro",
  "ChatGPT Plus",
  "Disney+ Hotstar",
];

const BRAND_CARDS = [
  { name: "Netflix", color: "#E50914", colorAlpha: "rgba(229, 9, 20, 0.15)" },
  { name: "Spotify", color: "#1DB954", colorAlpha: "rgba(29, 185, 84, 0.15)" },
  { name: "YouTube", color: "#FF0000", colorAlpha: "rgba(255, 0, 0, 0.15)" },
  { name: "Canva", color: "#00C4CC", colorAlpha: "rgba(0, 196, 204, 0.15)" },
  { name: "ChatGPT", color: "#10A37F", colorAlpha: "rgba(16, 163, 127, 0.15)" },
  { name: "Disney+", color: "#113CCF", colorAlpha: "rgba(17, 60, 207, 0.15)" },
];

/* ── Search component (Matches Products.jsx Search Box) ── */
function HeroSearch({ products = [] }) {
  const nav = useNavigate();
  const wrapRef = useRef(null);
  const searchInputRef = useRef(null);
  const listboxId = "hero-search-listbox";
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
    <div className="search-dropdown-anchor hx-search-wrap" ref={wrapRef}>
      <div className="hero-search-shell">
        <span className="hero-search-icon" aria-hidden="true">
          <Search size={16} />
        </span>
        <TypewriterSearchInput
          ref={searchInputRef}
          className="input hero-search-input"
          words={SEARCH_QUERIES}
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
            <X size={14} />
          </button>
        ) : null}
        <button
          className="hx-search-btn"
          onClick={() => goSearch()}
          type="button"
          aria-label="Cari"
        >
          <span>Cari</span>
          <ArrowRight size={14} />
        </button>
      </div>

      {open && suggestions.length > 0 ? (
        <div className="suggestions suggestions--animate" role="listbox" id={listboxId}>
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

function ActiveShoppersBadge() {
  const [activeShoppers, setActiveShoppers] = useState(1);

  useEffect(() => {
    const channel = supabase.channel("online-shoppers", {
      config: {
        presence: {
          key: "shopper-" + Math.random().toString(36).substring(2, 9),
        },
      },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const presenceState = channel.presenceState();
        const count = Object.keys(presenceState).length;
        setActiveShoppers(Math.max(1, count));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, []);

  return (
    <span className="hx-live-badge">
      <span className="hx-live-dot" />
      <span>Live Traffic: {activeShoppers} pembeli aktif</span>
    </span>
  );
}

function HeroStatsRow({ activeProductCount }) {
  const { last7DaysViews, totalOrders, todayOrders, weekOrders } = useLiveStats({
    intervalMs: 60000,
  });

  return (
    <>
      {[
        {
          val: totalOrders || 0,
          label: "Total Order",
          icon: ShoppingBag,
        },
        {
          val: weekOrders || 0,
          label: "Order (7 Hari)",
          accent: true,
          icon: Zap,
        },
        {
          val: activeProductCount,
          label: "Produk Aktif",
          icon: Package,
        },
        {
          val: last7DaysViews || 0,
          label: "Views (7 Hari)",
          icon: Eye,
        },
      ].map((s) => {
        const Icon = s.icon;
        return (
          <div
            key={s.label}
            className={`hx-stat-item${s.accent ? " hx-stat-item--accent" : ""}`}
          >
            <span className="hx-stat-val">
              {Icon && <Icon size={16} className="hx-stat-icon" />}
              <NumberCounter value={s.val} />
            </span>
            <span className="hx-stat-label">{s.label}</span>
          </div>
        );
      })}
    </>
  );
}

/* ── Main Hero Export ── */
export default function Hero({ products = [] }) {
  const nav = useNavigate();
  const prefersReduced = useReducedMotion();

  const activeProductCount = useMemo(
    () =>
      (products || []).filter((p) =>
        (p?.product_variants || []).some((v) => v?.is_active)
      ).length,
    [products]
  );

  const staggerChild = (delay = 0) =>
    prefersReduced
      ? {}
      : {
          initial: { opacity: 0, y: 24 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1], delay },
        };

  return (
    <section className="hx-hero" aria-label="Marketplace Hero">
      <div className="hx-mesh" aria-hidden="true" />
      <div className="hx-noise" aria-hidden="true" />
      <div className="hx-grid-overlay-container" aria-hidden="true">
        <div className="hx-grid-overlay" />
      </div>

      <div className="container">
        {/* We use standard div here so animation properties don't propagate incorrectly to motion children */}
        <div className="hx-hero-container">

          {/* 1. Live Traffic Badge */}
          <motion.div className="hx-live-badge-container" {...staggerChild(0.06)}>
            <ActiveShoppersBadge />
          </motion.div>

          {/* 2. Headline */}
          <motion.h1 className="hx-headline" {...staggerChild(0.12)}>
            Akses <span className="hx-headline-gradient">Premium</span>
            <br />
            Harga <span className="hx-headline-gradient">Pelajar</span>
          </motion.h1>

          {/* 3. Subtitle */}
          <motion.p className="hx-subtitle" {...staggerChild(0.2)}>
            {activeProductCount > 0
              ? `${activeProductCount}+ produk digital premium, bayar QRIS, aktif dalam hitungan menit.`
              : "Netflix, Spotify, Canva, dan lainnya, bayar QRIS, aktif dalam hitungan menit."}
          </motion.p>

          {/* 4. Search Console (Using identical style module to Products.jsx) */}
          <motion.div className="hx-search-section" {...staggerChild(0.28)}>
            <HeroSearch products={products} />
          </motion.div>

          {/* 5. Trust Badges */}
          <motion.div className="hx-brands-section" style={{ marginTop: "-8px" }} {...staggerChild(0.32)}>
            <div className="hx-brands-row">
              {TRUST_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="hx-brand-pill"
                    style={{ pointerEvents: "none", opacity: 0.85, fontSize: "11px", padding: "5px 12px" }}
                  >
                    <Icon size={11} className="hx-brand-pill-dot" style={{ color: "var(--accent)" }} />
                    <span>{item.label}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>


          {/* 7. Action CTAs */}
          <motion.div className="hx-ctas-row" {...staggerChild(0.44)}>
            <Link className="hx-btn-primary" to="/produk">
              <ShoppingBag size={14} aria-hidden="true" />
              <span>Lihat Katalog</span>
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
            <Link className="hx-btn-secondary" to="/status">
              Cek Status Pesanan
            </Link>
          </motion.div>

          {/* 8. Stats Counters Row */}
          <motion.div className="hx-stats-row" {...staggerChild(0.5)}>
            <HeroStatsRow activeProductCount={activeProductCount} />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
