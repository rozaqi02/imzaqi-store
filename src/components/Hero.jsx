import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Eye,
  Package,
  Search,
  ShoppingBag,
  X,
  Zap,
} from "lucide-react";
import { useLiveStats } from "../hooks/useLiveStats";
import NumberCounter from "./NumberCounter";
import { supabase } from "../lib/supabaseClient";
import TypewriterSearchInput from "./TypewriterSearchInput";
import { useDeviceCapability } from "../hooks/useIsMobile";
import { clearSearchHistory, getSearchHistory, pushSearchHistory } from "../lib/searchHistory";
import HeroCatalogBackdrop from "./HeroCatalogBackdrop";

const SEARCH_QUERIES = [
  "Netflix Premium",
  "Spotify Family",
  "YouTube Premium",
  "Canva Pro",
  "ChatGPT Plus",
  "Disney+ Hotstar",
];

/* ── Search ── */
function HeroSearch({ products = [] }) {
  const nav = useNavigate();
  const wrapRef = useRef(null);
  const searchInputRef = useRef(null);
  const listboxId = "hero-search-listbox";
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [historyTick, setHistoryTick] = useState(0);

  const suggestions = useMemo(() => {
    if (!q.trim()) {
      void historyTick;
      return open ? getSearchHistory() : [];
    }
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
  }, [q, products, open, historyTick]);

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

  const goSearch = useCallback(
    (value) => {
      const term = String(value || q || "").trim();
      if (!term) return;
      pushSearchHistory(term);
      setOpen(false);
      setActiveIdx(-1);
      nav(`/produk?q=${encodeURIComponent(term)}`);
    },
    [nav, q]
  );

  return (
    <div className="search-dropdown-anchor hx-search-wrap" ref={wrapRef}>
      <div className="hero-search-shell">
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
          aria-label="Cari produk"
        >
          <Search size={16} aria-hidden="true" />
        </button>
      </div>

      {open && suggestions.length > 0 ? (
        <div className="suggestions suggestions--animate" role="listbox" id={listboxId}>
          {!q.trim() ? (
            <div className="catalog-searchHistoryHead">
              <span className="catalog-searchHistoryLabel">Pencarian terakhir</span>
              <button
                type="button"
                className="catalog-searchHistoryClear"
                onClick={() => {
                  clearSearchHistory();
                  setHistoryTick((tick) => tick + 1);
                  setActiveIdx(-1);
                }}
              >
                Hapus
              </button>
            </div>
          ) : null}
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
      <span className="hx-live-eye" aria-hidden="true">
        <Eye size={14} strokeWidth={2.4} className="hx-live-eye-icon" />
      </span>
      <span>
        <strong>{activeShoppers}</strong> pembeli online
      </span>
    </span>
  );
}

function HeroStatsRow({ activeProductCount }) {
  const { last7DaysViews, totalOrders, weekOrders } = useLiveStats({
    intervalMs: 60000,
  });

  const stats = [
    { val: totalOrders || 0, label: "Total Order", icon: ShoppingBag },
    { val: weekOrders || 0, label: "Order 7 Hari", accent: true, icon: Zap },
    { val: activeProductCount, label: "Produk Aktif", icon: Package },
    { val: last7DaysViews || 0, label: "Views 7 Hari", icon: Eye },
  ];

  return (
    <>
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <div
            key={s.label}
            className={`hx-stat-item${s.accent ? " hx-stat-item--accent" : ""}`}
          >
            <span className="hx-stat-icon-wrap" aria-hidden="true">
              <Icon size={15} className="hx-stat-icon" />
            </span>
            <div className="hx-stat-meta">
              <span className="hx-stat-val">
                <NumberCounter value={s.val} />
              </span>
              <span className="hx-stat-label">{s.label}</span>
            </div>
          </div>
        );
      })}
    </>
  );
}

const VISITED_KEY = "imzaqi_visited_v1";

function OnboardingBanner() {
  const [show, setShow] = useState(() => {
    try {
      return !window.localStorage.getItem(VISITED_KEY);
    } catch {
      return false;
    }
  });

  if (!show) return null;

  return (
    <div className="hx-onboardBanner">
      <span className="hx-onboardText">
        Pertama kali? Ketik <strong>Netflix Premium</strong> atau{" "}
        <strong>Gas Lihat Katalog</strong> mulai belanja!
      </span>
      <button
        className="hx-onboardClose"
        type="button"
        onClick={() => {
          try {
            window.localStorage.setItem(VISITED_KEY, "1");
          } catch {}
          setShow(false);
        }}
        aria-label="Tutup"
      >
        <X size={14} />
      </button>
    </div>
  );
}

/* ── Main Hero ── */
export default function Hero({ products = [] }) {
  const caps = useDeviceCapability();
  const isMotionReduced = caps.isReducedMotion || caps.saveData || caps.lowMemory;

  const activeProductCount = useMemo(
    () =>
      (products || []).filter((p) =>
        (p?.product_variants || []).some((v) => v?.is_active)
      ).length,
    [products]
  );

  const stagger = (delay) =>
    isMotionReduced
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1], delay },
        };

  const MotionTag = isMotionReduced ? "div" : motion.div;
  const MotionP = isMotionReduced ? "p" : motion.p;

  return (
    <section className="hx-hero" aria-label="Marketplace Hero">
      <HeroCatalogBackdrop products={products} />
      <div className="hx-hero-scrim" aria-hidden="true" />
      <div className="container">
        <div className="hx-stage">
          <div className="hx-main">
            <MotionTag className="hx-eyebrow-row" {...stagger(0.04)}>
              <ActiveShoppersBadge />
            </MotionTag>

            <h1
              className={`hx-headline${isMotionReduced ? " hx-headline--static" : " hx-headline--enter"}`}
            >
              <span className="hx-headline-line">
                <span className="hx-headline-mask">
                  <span className="hx-headline-word" style={{ "--w": 0 }}>
                    Akses
                  </span>
                </span>{" "}
                <span className="hx-headline-mask">
                  <span className="hx-headline-word hx-headline-gradient" style={{ "--w": 1 }}>
                    Premium
                  </span>
                </span>
              </span>
              <span className="hx-headline-line">
                <span className="hx-headline-mask">
                  <span className="hx-headline-word" style={{ "--w": 2 }}>
                    Budget
                  </span>
                </span>{" "}
                <span className="hx-headline-mask">
                  <span className="hx-headline-word hx-headline-gradient" style={{ "--w": 3 }}>
                    Pelajar
                  </span>
                </span>
              </span>
            </h1>

            <MotionP className="hx-subtitle" {...stagger(0.12)}>
              Akses premium tanpa boncos: pilih paket, scan QRIS, lacak status order kamu.
            </MotionP>

            <OnboardingBanner />

            <MotionTag className="hx-search-section" {...stagger(0.18)}>
              <HeroSearch products={products} />
            </MotionTag>

            <MotionTag className="hx-ctas-row" {...stagger(0.24)}>
              <Link className="hx-btn-primary" to="/produk">
                <ShoppingBag size={15} aria-hidden="true" />
                <span>Gas Lihat Katalog</span>
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </MotionTag>
          </div>

          <MotionTag className="hx-stats-row" {...stagger(0.3)} aria-label="Statistik toko">
            <HeroStatsRow activeProductCount={activeProductCount} />
          </MotionTag>
        </div>
      </div>
    </section>
  );
}
