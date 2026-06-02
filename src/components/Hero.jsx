import { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Search,
  ChevronLeft,
  ChevronRight,
  Film,
  Music4,
  Blocks,
  GraduationCap,
  Sparkles,
  Copy
} from "lucide-react";
import { useLiveStats } from "../hooks/useLiveStats";
import { copyToClipboard } from "../utils/clipboard";
import { useToast } from "../context/ToastContext";
import NumberCounter from "./NumberCounter";

const QUICK_CATEGORIES = [
  { key: "streaming", label: "Streaming", icon: Film, color: "#ff5252" },
  { key: "music", label: "Musik", icon: Music4, color: "#2ecc71" },
  { key: "tools", label: "Desain/Tools", icon: Blocks, color: "#9b59b6" },
  { key: "learning", label: "Belajar", icon: GraduationCap, color: "#3498db" }
];

export default function Hero({ products = [], promos = [], flashSales = [] }) {
  const nav = useNavigate();
  const toast = useToast();
  const { todayViews, totalOrders } = useLiveStats({ intervalMs: 60000 });

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [prefersReduced, setPrefersReduced] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);

  const wrapRef = useRef(null);
  const listboxId = "hero-search-listbox";

  // Check prefers reduced motion
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReduced(mq.matches);
    const h = () => setPrefersReduced(mq.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  // Dynamic slides from products list (first 5 active products)
  const carouselSlides = useMemo(() => {
    const activeProducts = (products || []).filter((p) => p.is_active);
    
    // Filter active promo codes from the database
    const activePromos = (promos || []).filter((p) => {
      if (!p.is_active) return false;
      if (p.expired_at && new Date(p.expired_at) < new Date()) return false;
      if (p.max_uses != null && p.used_count >= p.max_uses) return false;
      return true;
    });

    // Fallback if products are empty/loading
    const defaultSlides = [
      {
        id: "fb-1",
        badge: "PROMO BULAN INI",
        title: "Netflix Premium Ultra HD",
        desc: "Nonton serial TV, film, dan drakor sepuasnya tanpa gangguan iklan.",
        discount: "Diskon 50%",
        coupon: "NETFLIXASIK",
        cta: "Netflix",
        gradient: "linear-gradient(135deg, #e50914 0%, #7d0202 50%, #2b0000 100%)",
        glow: "radial-gradient(circle, rgba(229, 9, 20, 0.35) 0%, rgba(229, 9, 20, 0) 70%)",
        icon_url: ""
      },
      {
        id: "fb-2",
        badge: "FAMILY PLAN",
        title: "Spotify Premium",
        desc: "Putar lagu favorit tanpa iklan, unduh offline, kualitas audio sangat tinggi.",
        discount: "Hemat 40%",
        coupon: "SPOTIFYHEBAT",
        cta: "Spotify",
        gradient: "linear-gradient(135deg, #1db954 0%, #106b2e 50%, #032b10 100%)",
        glow: "radial-gradient(circle, rgba(29, 185, 84, 0.35) 0%, rgba(29, 185, 84, 0) 70%)",
        icon_url: ""
      },
      {
        id: "fb-3",
        badge: "DESAIN INSTAN",
        title: "Canva Pro & Tools AI",
        desc: "Akses jutaan template, elemen premium, dan fitur AI ajaib untuk konten Anda.",
        discount: "Mulai 10rb",
        coupon: "CANVAPRO",
        cta: "Canva",
        gradient: "linear-gradient(135deg, #8a2be2 0%, #510e96 50%, #1e0042 100%)",
        glow: "radial-gradient(circle, rgba(138, 43, 226, 0.35) 0%, rgba(138, 43, 226, 0) 70%)",
        icon_url: ""
      }
    ];

    if (activeProducts.length === 0) {
      return defaultSlides;
    }

    const gradients = [
      "linear-gradient(135deg, #e50914 0%, #7d0202 50%, #2b0000 100%)",
      "linear-gradient(135deg, #1db954 0%, #106b2e 50%, #032b10 100%)",
      "linear-gradient(135deg, #8a2be2 0%, #510e96 50%, #1e0042 100%)",
      "linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)",
      "linear-gradient(135deg, #10b981 0%, #047857 100%)"
    ];

    return activeProducts.slice(0, 5).map((p, idx) => {
      const activeVars = (p.product_variants || []).filter((v) => v.is_active);
      const prices = activeVars.map((v) => Number(v.price_idr || 0)).filter((price) => price > 0);
      const minPrice = prices.length ? Math.min(...prices) : null;
      
      const priceLabel = minPrice ? `Mulai Rp ${minPrice.toLocaleString("id-ID")}` : "Promo Spesial";
      
      // Ambil diskon flash sale aktif untuk varian produk ini
      const variantIds = activeVars.map((v) => v.id);
      const activeSales = (flashSales || []).filter((fs) => variantIds.includes(fs.variant_id));
      const maxFlashDiscount = activeSales.length
        ? Math.max(...activeSales.map((fs) => fs.discount_percent))
        : 0;

      let discountText = priceLabel;
      if (maxFlashDiscount > 0) {
        discountText = `Diskon ${maxFlashDiscount}%`;
      } else {
        // Jika tidak ada flash sale, cari kupon diskon tertinggi dan tampilkan "Hemat s/d X%"
        const maxPromoPercent = activePromos.length
          ? Math.max(...activePromos.map((pr) => pr.percent))
          : 0;
        if (maxPromoPercent > 0) {
          discountText = `Hemat s/d ${maxPromoPercent}%`;
        }
      }

      // Ambil kupon secara dinamis dari database (cycle through active promos)
      const promoCoupon = activePromos.length
        ? activePromos[idx % activePromos.length].code
        : "IMZAQI";

      const firstLineDesc = p.description 
        ? p.description.split(/\r?\n/)[0].trim() 
        : "Dapatkan akses premium instan dengan jaminan garansi penuh.";

      // Brand glow radial gradient kustom
      const nameLower = p.name.toLowerCase();
      let glow = "radial-gradient(circle, rgba(78, 255, 218, 0.25) 0%, rgba(78, 255, 218, 0) 70%)";
      if (nameLower.includes("netflix")) glow = "radial-gradient(circle, rgba(229, 9, 20, 0.35) 0%, rgba(229, 9, 20, 0) 70%)";
      else if (nameLower.includes("spotify")) glow = "radial-gradient(circle, rgba(29, 185, 84, 0.35) 0%, rgba(29, 185, 84, 0) 70%)";
      else if (nameLower.includes("canva")) glow = "radial-gradient(circle, rgba(138, 43, 226, 0.35) 0%, rgba(138, 43, 226, 0) 70%)";
      else if (nameLower.includes("iqiyi")) glow = "radial-gradient(circle, rgba(0, 196, 204, 0.35) 0%, rgba(0, 196, 204, 0) 70%)";
      else if (nameLower.includes("disney")) glow = "radial-gradient(circle, rgba(17, 60, 207, 0.35) 0%, rgba(17, 60, 207, 0) 70%)";
      else if (nameLower.includes("youtube")) glow = "radial-gradient(circle, rgba(255, 0, 0, 0.35) 0%, rgba(255, 0, 0, 0) 70%)";
      else if (nameLower.includes("chatgpt")) glow = "radial-gradient(circle, rgba(16, 163, 127, 0.35) 0%, rgba(16, 163, 127, 0) 70%)";

      return {
        id: p.id,
        badge: p.category ? p.category.toUpperCase() : "APPS",
        title: p.name,
        desc: firstLineDesc.length > 80 ? `${firstLineDesc.slice(0, 78)}...` : firstLineDesc,
        discount: discountText,
        coupon: promoCoupon,
        cta: p.name,
        gradient: gradients[idx % gradients.length],
        glow,
        icon_url: p.icon_url
      };
    });
  }, [products, promos, flashSales]);

  // Autoplay loop based on active carousel length
  useEffect(() => {
    if (carouselSlides.length <= 1) return;
    const timer = setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % carouselSlides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [carouselSlides.length]);

  // Sync index if slide list changes
  useEffect(() => {
    if (slideIndex >= carouselSlides.length) {
      setSlideIndex(0);
    }
  }, [carouselSlides.length, slideIndex]);

  // Autocomplete Suggestions
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

  function handleCopyPromo(code) {
    copyToClipboard(code).then(
      () => {
        if (navigator.vibrate) {
          navigator.vibrate(12);
        }
        toast.success("Kode promo berhasil disalin!", { title: code, duration: 2000 });
      },
      () => {
        toast.error("Gagal menyalin kode promo.");
      }
    );
  }

  const getCategoryIcon = (badge) => {
    const b = String(badge || "").toLowerCase();
    if (b.includes("streaming")) return Film;
    if (b.includes("music") || b.includes("musik")) return Music4;
    if (b.includes("tools") || b.includes("desain")) return Blocks;
    if (b.includes("learning") || b.includes("belajar")) return GraduationCap;
    return Sparkles;
  };

  const fade = (delay = 0) =>
    prefersReduced
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] },
        };

  return (
    <section className="hm-hero" aria-label="Marketplace Hero">
      <div className="container hm-container">
        
        {/* ── Baris Atas: Headline Ringkas & Bilah Pencarian Utama ── */}
        <div className="hm-header">
          <motion.div className="hm-headline" {...fade(0)}>
            <h1 className="hm-main-title">Akses Premium. Harga Pelajar.</h1>
          </motion.div>
          
          <motion.div className="hm-search-container" ref={wrapRef} {...fade(0.12)}>
            <div className="hero-search-shell">
              <span className="hero-search-icon" aria-hidden="true">
                <Search size={16} />
              </span>
              <input
                className="input hero-search-input"
                placeholder="Cari aplikasi atau software premium..."
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
          </motion.div>
        </div>

        {/* ── Baris Tengah: Grid Layout Marketplace ── */}
        <div className="hm-grid">
          
          {/* Kiri: Slider Banner Utama (2/3) */}
          <div className="hm-slider-col">
            <div className="hm-slider-wrapper">
              <AnimatePresence mode="wait">
                {carouselSlides.map((slide, idx) => {
                  if (idx !== slideIndex) return null;
                  const FallbackIcon = getCategoryIcon(slide.badge);
                  return (
                    <motion.div
                      key={slide.id}
                      className="hm-slide"
                      style={{ background: slide.gradient }}
                      initial={prefersReduced ? {} : { opacity: 0, x: 20 }}
                      animate={prefersReduced ? {} : { opacity: 1, x: 0 }}
                      exit={prefersReduced ? {} : { opacity: 0, x: -20 }}
                      transition={{ duration: 0.4 }}
                    >
                      <div className="hm-slide-content">
                        <div className="hm-slide-badge-row">
                          <span className="hm-slide-badge">{slide.badge}</span>
                          <span className="hm-slide-discount">{slide.discount}</span>
                        </div>
                        
                        <h2 className="hm-slide-title">{slide.title}</h2>
                        <p className="hm-slide-desc">{slide.desc}</p>
                        
                        <div className="hm-slide-promo-box">
                          <div className="hm-coupon-stub" onClick={() => handleCopyPromo(slide.coupon)}>
                            <Copy size={13} />
                            <span>Kode Promo: <strong>{slide.coupon}</strong></span>
                          </div>
                          <button
                            className="btn hm-slide-btn"
                            onClick={() => nav(`/produk?q=${encodeURIComponent(slide.cta)}`)}
                          >
                            <span>Dapatkan Sekarang</span>
                            <ArrowRight size={14} />
                          </button>
                        </div>
                      </div>
                      
                      <div className="hm-slide-media" aria-hidden="true">
                        <div className="hm-slide-circle-glow" style={{ background: slide.glow }} />
                        {slide.icon_url ? (
                          <img src={slide.icon_url} alt={slide.title} className="hm-slide-floating-image" />
                        ) : (
                          <FallbackIcon size={120} strokeWidth={1} className="hm-slide-floating-icon" />
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              
              {/* Slider Navigation */}
              {carouselSlides.length > 1 && (
                <>
                  <button
                    className="hm-nav-arrow prev"
                    onClick={() => setSlideIndex((prev) => (prev === 0 ? carouselSlides.length - 1 : prev - 1))}
                    aria-label="Slide sebelumnya"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    className="hm-nav-arrow next"
                    onClick={() => setSlideIndex((prev) => (prev + 1) % carouselSlides.length)}
                    aria-label="Slide berikutnya"
                  >
                    <ChevronRight size={20} />
                  </button>
                  
                  <div className="hm-slider-dots">
                    {carouselSlides.map((_, i) => (
                      <button
                        key={i}
                        className={`hm-dot${i === slideIndex ? " active" : ""}`}
                        onClick={() => setSlideIndex(i)}
                        aria-label={`Buka slide ${i + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

        </div>

        {/* ── Baris Bawah: Quick Links Kategori ── */}
        <div className="hm-quick-links">
          <div className="hm-quick-title">Pilih Cepat Kategori:</div>
          <div className="hm-quick-grid">
            {QUICK_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.key}
                  className="hm-quick-item scale-hover"
                  onClick={() => nav(`/produk?cats=${cat.key}`)}
                >
                  <div className="hm-quick-icon-wrapper" style={{ "--cat-color": cat.color }}>
                    <Icon size={20} />
                  </div>
                  <span className="hm-quick-label">{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Live Ticker Statistik ── */}
        <div className="hm-ticker">
          <div className="hm-ticker-inner">
            <span className="hm-ticker-dot" />
            <span className="hm-ticker-text">
              Real-time Stats:{" "}
              <strong>
                <NumberCounter value={totalOrders || 0} />
              </strong>{" "}
              pesanan diproses ·{" "}
              <strong>
                <NumberCounter value={todayViews || 0} />
              </strong>{" "}
              pengunjung hari ini
            </span>
          </div>
        </div>

      </div>
    </section>
  );
}
