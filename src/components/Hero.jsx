import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { ArrowRight, ScanSearch, Search, Zap } from "lucide-react";
import { useLiveStats } from "../hooks/useLiveStats";
import NumberCounter from "./NumberCounter";

export default function Hero({ products = [] }) {
  const nav = useNavigate();
  const location = useLocation();
  const { totalViews, todayViews, totalOrders, weekOrders } = useLiveStats();

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [lightMotion, setLightMotion] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(max-width: 920px), (pointer: coarse)").matches;
  });
  const wrapRef = useRef(null);
  const stageRef = useRef(null);

  // Pointer tracking for parallax effect (desktop only)
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);
  const smoothX = useSpring(mouseX, { stiffness: 80, damping: 20, mass: 0.6 });
  const smoothY = useSpring(mouseY, { stiffness: 80, damping: 20, mass: 0.6 });

  const orbAX = useTransform(smoothX, [0, 1], [-30, 30]);
  const orbAY = useTransform(smoothY, [0, 1], [-20, 20]);
  const orbBX = useTransform(smoothX, [0, 1], [25, -25]);
  const orbBY = useTransform(smoothY, [0, 1], [15, -15]);
  const orbCX = useTransform(smoothX, [0, 1], [-15, 15]);
  const orbCY = useTransform(smoothY, [0, 1], [-25, 25]);
  const meshRotate = useTransform(smoothX, [0, 1], [-3, 3]);

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const query = window.matchMedia("(max-width: 920px), (pointer: coarse)");
    const update = () => setLightMotion(query.matches);
    update();
    if (query.addEventListener) {
      query.addEventListener("change", update);
      return () => query.removeEventListener("change", update);
    }
    query.addListener(update);
    return () => query.removeListener(update);
  }, []);

  useEffect(() => {
    if (lightMotion || !stageRef.current) return undefined;
    const stage = stageRef.current;
    let frame = 0;
    const onMove = (e) => {
      const rect = stage.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        mouseX.set(Math.max(0, Math.min(1, x)));
        mouseY.set(Math.max(0, Math.min(1, y)));
      });
    };
    stage.addEventListener("mousemove", onMove);
    return () => {
      stage.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(frame);
    };
  }, [lightMotion, mouseX, mouseY]);

  const searchIndex = useMemo(() => {
    const words = [];
    (products || []).forEach((product) => {
      if (product?.name) words.push(product.name);
      if (product?.slug) words.push(product.slug.replace(/-/g, " "));
      (product?.product_variants || []).forEach((variant) => {
        if (variant?.name) words.push(`${product.name} ${variant.name}`);
      });
    });
    return Array.from(new Set(words.map((text) => String(text).trim()).filter(Boolean)));
  }, [products]);

  const suggestions = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return searchIndex.filter((x) => x.toLowerCase().includes(s)).slice(0, 6);
  }, [q, searchIndex]);

  useEffect(() => {
    if (activeSuggestionIndex < suggestions.length) return;
    setActiveSuggestionIndex(-1);
  }, [activeSuggestionIndex, suggestions.length]);

  useEffect(() => {
    function onDoc(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setActiveSuggestionIndex(-1);
      }
    }
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

  const stats = [
    { label: "Total Kunjungan", value: totalViews },
    { label: "Hari Ini", value: todayViews },
    { label: "Total Order", value: totalOrders },
    { label: "Minggu Ini", value: weekOrders },
  ];

  const listboxId = "hero-search-listbox";

  // Pick up to 4 product icons for floating orbs
  const orbProducts = useMemo(() => {
    return (products || []).filter((p) => p?.icon_url).slice(0, 4);
  }, [products]);

  return (
    <section className="hero hero-v2 full-bleed" ref={stageRef}>
      {/* Animated background mesh */}
      <div className="hero-v2-bg" aria-hidden="true">
        <motion.div
          className="hero-v2-mesh"
          style={lightMotion ? undefined : { rotate: meshRotate }}
        />
        {!lightMotion && (
          <>
            <motion.div className="hero-v2-orb hero-v2-orb-a" style={{ x: orbAX, y: orbAY }} />
            <motion.div className="hero-v2-orb hero-v2-orb-b" style={{ x: orbBX, y: orbBY }} />
            <motion.div className="hero-v2-orb hero-v2-orb-c" style={{ x: orbCX, y: orbCY }} />
          </>
        )}
        <div className="hero-v2-grid" />
      </div>

      <div className="container hero-v2-inner">
        {/* Floating product orbs (desktop only) */}
        {!lightMotion && orbProducts.length > 0 && (
          <div className="hero-v2-floaters" aria-hidden="true">
            {orbProducts.map((p, i) => {
              const offsets = [
                { top: "12%", left: "8%", delay: 0 },
                { top: "18%", right: "10%", delay: 0.4 },
                { bottom: "20%", left: "12%", delay: 0.8 },
                { bottom: "14%", right: "8%", delay: 1.2 },
              ];
              const pos = offsets[i] || offsets[0];
              return (
                <motion.div
                  key={p.id}
                  className="hero-v2-floater"
                  style={pos}
                  initial={{ opacity: 0, scale: 0.6, y: 20 }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    y: 0,
                  }}
                  transition={{
                    delay: 0.3 + (pos.delay || 0),
                    duration: 0.8,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <motion.div
                    className="hero-v2-floaterInner"
                    animate={{
                      y: [0, -8, 0],
                    }}
                    transition={{
                      delay: pos.delay || 0,
                      duration: 4 + i * 0.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    <img src={p.icon_url} alt="" loading="lazy" decoding="async" />
                  </motion.div>
                </motion.div>
              );
            })}
          </div>
        )}

        <motion.div
          className="hero-v2-eyebrow"
          initial={lightMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <span>Imzaqi Store</span>
        </motion.div>

        <motion.h1
          className="hero-v2-title"
          initial={lightMotion ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        >
          Pilih paket. <span className="hero-v2-titleLine hero-v2-titleLine--accent">Bergaransi.</span>
        </motion.h1>

        <motion.p
          className="hero-v2-sub"
          initial={lightMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
        >
          Dari katalog sampai status order, langkah berikutnya selalu jelas.
        </motion.p>

        <motion.div
          className="hero-v2-search"
          ref={wrapRef}
          initial={lightMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.26, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="hero-search-shell hero-v2-searchShell">
            <span className="hero-search-icon" aria-hidden="true">
              <Search size={16} />
            </span>
            <input
              className="input hero-search-input"
              placeholder="Cari produk favoritmu"
              value={q}
              aria-label="Cari produk"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={open && suggestions.length > 0}
              aria-controls={open && suggestions.length > 0 ? listboxId : undefined}
              aria-activedescendant={
                activeSuggestionIndex >= 0 ? `${listboxId}-option-${activeSuggestionIndex}` : undefined
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
                  setActiveSuggestionIndex((prev) =>
                    prev >= suggestions.length - 1 ? 0 : prev + 1
                  );
                  return;
                }
                if (e.key === "ArrowUp" && suggestions.length > 0) {
                  e.preventDefault();
                  setOpen(true);
                  setActiveSuggestionIndex((prev) =>
                    prev <= 0 ? suggestions.length - 1 : prev - 1
                  );
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
            <button className="btn hero-search-btn" onClick={() => goSearch()} type="button" aria-label="Cari">
              <ArrowRight size={16} />
            </button>

            {open && suggestions.length > 0 ? (
              <motion.div
                initial={lightMotion ? false : { opacity: 0, y: 8 }}
                animate={lightMotion ? undefined : { opacity: 1, y: 0 }}
                className="suggestions suggestions-minimal"
                role="listbox"
                id={listboxId}
              >
                {suggestions.map((sug, idx) => (
                  <button
                    key={sug}
                    id={`${listboxId}-option-${idx}`}
                    className={`suggestion-item${idx === activeSuggestionIndex ? " is-active" : ""}`}
                    onClick={() => goSearch(sug)}
                    onMouseEnter={() => setActiveSuggestionIndex(idx)}
                    type="button"
                    role="option"
                    aria-selected={idx === activeSuggestionIndex}
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
          className="hero-v2-ctas"
          initial={lightMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.34, ease: [0.22, 1, 0.36, 1] }}
        >
          <Link className="btn hero-v2-ctaPrimary" to="/produk">
            <ScanSearch size={16} />
            <span>Lihat katalog</span>
          </Link>
          <Link
            className="btn btn-ghost hero-v2-ctaGhost"
            to="/checkout"
            state={{ backgroundLocation: location }}
          >
            <Zap size={16} />
            <span>Checkout</span>
          </Link>
        </motion.div>

        <motion.div
          className="hero-v2-stats"
          initial={lightMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.42, ease: [0.22, 1, 0.36, 1] }}
        >
          {stats.map((item) => (
            <div key={item.label} className="hero-v2-stat">
              <div className="hero-v2-statNum">
                {item.value == null ? "-" : <NumberCounter value={item.value} />}
              </div>
              <div className="hero-v2-statLabel">{item.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
