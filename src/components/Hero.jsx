import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  ScanSearch,
  Search,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { fetchProducts } from "../lib/api";
import { useLiveStats } from "../hooks/useLiveStats";

const HERO_TEXT = "Premium apps. Fast checkout.";
const HIGHLIGHT = "Fast checkout";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.58, ease: [0.22, 1, 0.36, 1] },
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
  const [typed, setTyped] = useState("");
  const [index, setIndex] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduce) {
      setTyped(HERO_TEXT);
      return undefined;
    }

    let i = 0;
    const timer = window.setInterval(() => {
      i += 1;
      setTyped(HERO_TEXT.slice(0, i));
      if (i >= HERO_TEXT.length) window.clearInterval(timer);
    }, 34);

    return () => window.clearInterval(timer);
  }, []);

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
    return index.filter((x) => x.toLowerCase().includes(s)).slice(0, 6);
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

  const stats = [
    { label: "Visit", value: totalViews },
    { label: "Today", value: todayViews },
    { label: "Orders", value: totalOrders },
    { label: "Order hari ini", value: todayOrders },
  ];

  const flow = [
    { icon: ScanSearch, label: "Pilih" },
    { icon: CreditCard, label: "Bayar" },
    { icon: CheckCircle2, label: "Upload" },
    { icon: ShieldCheck, label: "Pantau" },
  ];

  return (
    <section className="hero hero-minimal full-bleed">
      <div className="container hero-minimal-grid">
        <div className="hero-copy">
          <motion.div
            custom={0}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="hero-eyebrow"
          >
            Premium apps store
          </motion.div>

          <motion.h1
            custom={1}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="hero-title hero-title-minimal"
          >
            <span className="typewriter">
              {renderTypedWithHighlight(typed)}
              <span className="cursor" aria-hidden="true" />
            </span>
          </motion.h1>

          <motion.p
            custom={2}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="hero-sub hero-sub-minimal"
          >
            Cari, pilih, bayar, upload.
          </motion.p>

          <motion.div
            custom={3}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="hero-rail"
          >
            {flow.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="hero-railItem">
                  <span className="hero-railIcon">
                    <Icon size={15} />
                  </span>
                  <span>{item.label}</span>
                </div>
              );
            })}
          </motion.div>

          <motion.div
            custom={4}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="hero-search hero-search-minimal"
            ref={wrapRef}
          >
            <div className="hero-search-shell">
              <span className="hero-search-icon" aria-hidden="true">
                <Search size={16} />
              </span>

              <input
                className="input hero-search-input"
                placeholder="Cari Netflix, Canva, ChatGPT"
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

              {q ? (
                <button
                  type="button"
                  className="hero-search-clear"
                  onClick={() => {
                    setQ("");
                    setOpen(false);
                  }}
                  aria-label="Hapus pencarian"
                >
                  x
                </button>
              ) : null}

              <button className="btn hero-search-btn" onClick={() => goSearch()} type="button">
                <ArrowRight size={16} />
              </button>

              {open && suggestions.length > 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="suggestions suggestions-minimal"
                  role="listbox"
                >
                  {suggestions.map((sug) => (
                    <button
                      key={sug}
                      className="suggestion-item"
                      onClick={() => goSearch(sug)}
                      type="button"
                      role="option"
                      aria-selected={false}
                    >
                      <Search size={14} />
                      <span>{sug}</span>
                    </button>
                  ))}
                </motion.div>
              ) : null}
            </div>
          </motion.div>

          <motion.div
            custom={5}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="hero-ctas hero-ctas-minimal"
          >
            <Link className="btn" to="/produk">
              <ScanSearch size={16} />
              <span>Produk</span>
            </Link>
            <Link className="btn btn-ghost" to="/checkout">
              <Zap size={16} />
              <span>Checkout</span>
            </Link>
          </motion.div>

          <motion.div
            className="hero-stats hero-stats-minimal"
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.08, delayChildren: 0.5 } } }}
          >
            {stats.map((item, idx) => (
              <motion.div
                key={item.label}
                className="stat stat-minimal"
                variants={{ hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } }}
                whileHover={{ y: -4 }}
                custom={idx}
              >
                <div className="stat-num">
                  {item.value == null ? "-" : Number(item.value).toLocaleString("id-ID")}
                </div>
                <div className="stat-label">{item.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        <motion.div
          className="hero-visual"
          initial={{ opacity: 0, scale: 0.96, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="hero-panel">
            <div className="hero-panelHead">
              <div className="hero-panelDots">
                <span />
                <span />
                <span />
              </div>
              <div className="hero-panelLabel">Order flow</div>
            </div>

            <div className="hero-flowStack">
              {flow.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.label}
                    className="hero-flowCard"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.35 + idx * 0.08, duration: 0.45 }}
                  >
                    <div className="hero-flowIcon">
                      <Icon size={16} />
                    </div>
                    <div className="hero-flowText">
                      <strong>{item.label}</strong>
                      <span />
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="hero-panelBars" aria-hidden="true">
              <span style={{ height: "34%" }} />
              <span style={{ height: "52%" }} />
              <span style={{ height: "68%" }} />
              <span style={{ height: "82%" }} />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
