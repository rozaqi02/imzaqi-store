import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
// Import Framer Motion untuk animasi tingkat lanjut
import { motion, AnimatePresence } from "framer-motion"; 

import ProductCard from "../components/ProductCard";
import { fetchProducts } from "../lib/api";
import EmptyState from "../components/EmptyState";
import { usePageMeta } from "../hooks/usePageMeta";
import { useCart } from "../context/CartContext";
import { formatIDR } from "../lib/format";

// Konfigurasi Animasi Framer Motion
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05 // Efek muncul berurutan yang cepat
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 24 } },
  exit: { opacity: 0, scale: 0.9, transition: { duration: 0.15 } }
};

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQ = searchParams.get("q") || "";
  
  const cart = useCart();
  const cartItemCount = cart.items.reduce((a, b) => a + b.qty, 0);

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState(initialQ);
  const [error, setError] = useState("");
  const [layout, setLayout] = useState("grid");
  const [sortBy, setSortBy] = useState("default");
  const [showTopBtn, setShowTopBtn] = useState(false);

  usePageMeta({
    title: query && query !== "Semua" ? `Cari: ${query}` : "Produk",
    description: "Katalog lengkap produk digital murah berkualitas.",
  });

  useEffect(() => {
    const handleScroll = () => {
      setShowTopBtn(window.scrollY > 400);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setQuery(initialQ);
  }, [initialQ]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await fetchProducts();
        if (!alive) return;
        setProducts(data);
      } catch (e) {
        console.warn(e);
        setError("Gagal memuat produk.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const dynamicTags = useMemo(() => {
    if (products.length === 0) return ["Semua"];
    const brands = products
      .filter(p => p.is_active)
      .map(p => p.name.trim().split(" ")[0]); 
    const uniqueBrands = [...new Set(brands)].sort();
    return ["Semua", ...uniqueBrands];
  }, [products]);

  const filtered = useMemo(() => {
    let result = [...products];
    const q = query.trim().toLowerCase();

    if (q && q !== "semua") {
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.slug || "").toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q) ||
        (p.product_variants || []).some(v =>
          v.name.toLowerCase().includes(q) ||
          (v.duration_label || "").toLowerCase().includes(q)
        )
      );
    }

    if (sortBy === "name_asc") {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "price_asc" || sortBy === "price_desc") {
      const getMinPrice = (p) => {
        if (!p.product_variants?.length) return 0;
        return Math.min(...p.product_variants.map(v => v.price_idr));
      };
      
      result.sort((a, b) => {
        const pA = getMinPrice(a);
        const pB = getMinPrice(b);
        return sortBy === "price_asc" ? pA - pB : pB - pA;
      });
    } else {
      result.sort((a, b) => a.sort_order - b.sort_order);
    }

    return result;
  }, [products, query, sortBy]);

  function onChangeQuery(next) {
    setQuery(next);
    const trimmed = next.trim();
    if (!trimmed || trimmed.toLowerCase() === "semua") {
      searchParams.delete("q");
      setSearchParams(searchParams, { replace: true });
    } else {
      setSearchParams({ q: trimmed }, { replace: true });
    }
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="page with-sticky-cta">
      <section className="section">
        <div className="container section-head" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 20 }}>
          
          {/* Breadcrumbs DIHAPUS sesuai permintaan */}

          <div className="layout-header" style={{ marginBottom: 0 }}>
            <div className="header-title">
              <h1 className="h1">Produk</h1>
              <p className="muted">Koleksi produk digital terbaik.</p>
            </div>
            
            <div className="header-controls">
              {/* Toggle Layout dengan animasi scale kecil saat ditekan */}
              <div className="layout-toggles">
                <motion.button 
                  whileTap={{ scale: 0.9 }}
                  className={`toggle-btn ${layout === 'grid' ? 'active' : ''}`}
                  onClick={() => setLayout('grid')}
                  title="Grid View"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                </motion.button>
                <motion.button 
                  whileTap={{ scale: 0.9 }}
                  className={`toggle-btn ${layout === 'list' ? 'active' : ''}`}
                  onClick={() => setLayout('list')}
                  title="List View"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                </motion.button>
              </div>

              <div className="search-wrapper">
                <input
                  className="input header-search"
                  placeholder="Cari..."
                  value={query === "Semua" ? "" : query}
                  onChange={(e) => onChangeQuery(e.target.value)}
                />
                {query && query !== "Semua" && (
                  <button className="search-clear-btn" onClick={() => onChangeQuery("")} title="Hapus">✕</button>
                )}
              </div>
            </div>
          </div>

          <div className="quick-tags-scroll">
            {dynamicTags.map((tag) => {
              const isActive = tag.toLowerCase() === "semua" 
                ? (!query || query.toLowerCase() === "semua")
                : query.toLowerCase().includes(tag.toLowerCase());

              return (
                <button
                  key={tag}
                  className={`tag-pill ${isActive ? "active" : ""}`}
                  onClick={() => onChangeQuery(tag === "Semua" ? "" : tag)}
                >
                  {tag}
                </button>
              );
            })}
          </div>

          <div className="controls-row">
            <div className="result-count">
              {loading ? "Memuat..." : (
                <motion.span 
                  // Animasi kecil pada angka saat berubah
                  key={filtered.length}
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  Menampilkan <b>{filtered.length}</b> produk
                </motion.span>
              )}
            </div>

            <select 
              className="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="default">Rekomendasi</option>
              <option value="price_asc">Harga Terendah</option>
              <option value="price_desc">Harga Tertinggi</option>
              <option value="name_asc">Nama (A-Z)</option>
            </select>
          </div>

        </div>

        {/* === CONTAINER UTAMA DENGAN FRAMER MOTION ===
          'layout' prop di sini membuat container beranimasi mulus 
          saat CSS class berubah dari 'grid-mode' ke 'list-mode'.
        */}
        <motion.div 
          layout 
          className={`container product-grid-container ${layout === 'grid' ? 'grid-mode' : 'list-mode'}`}
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          <AnimatePresence mode="popLayout">
            {loading ? (
              // Skeleton loading state
              [...Array(4)].map((_, i) => (
                <motion.div 
                  key={`skeleton-${i}`}
                  variants={itemVariants}
                  className="skeleton card" 
                />
              ))
            ) : error ? (
              <motion.div 
                key="error" 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="card pad" style={{ gridColumn: "1 / -1" }}
              >
                <EmptyState
                  icon="📡"
                  title="Gagal memuat"
                  description={error}
                  primaryAction={{ label: "Refresh", onClick: () => window.location.reload() }}
                />
              </motion.div>
            ) : filtered.length === 0 ? (
              <motion.div 
                key="empty"
                variants={itemVariants}
                initial="hidden" animate="show" exit="exit"
                className="card pad" style={{ gridColumn: "1 / -1" }}
              >
                <EmptyState
                  icon="🤔"
                  title="Tidak ditemukan"
                  description={`Kami tidak menemukan produk untuk "${query}".`}
                  primaryAction={{ label: "Hapus Pencarian", onClick: () => onChangeQuery("") }}
                />
                <div className="suggestion-chips">
                  <div style={{width:'100%', textAlign:'center', fontSize:12, opacity:0.6, marginBottom:4}}>Mungkin maksudmu:</div>
                  {["Netflix", "Spotify", "Youtube", "Canva"].map(s => (
                    <button key={s} className="chip-btn" onClick={() => onChangeQuery(s)}>{s}</button>
                  ))}
                </div>
              </motion.div>
            ) : (
              // Mapping Produk
              filtered.map((p) => (
                <motion.div 
                  key={p.id}
                  // 'layout' prop di sini adalah KUNCI agar item bergeser mulus
                  // saat posisi mereka berubah karena filtering/sorting
                  layout 
                  variants={itemVariants}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  // Menggunakan transition spring agar terasa 'kenyal' dan premium
                  transition={{ 
                    layout: { type: "spring", stiffness: 300, damping: 30 },
                    opacity: { duration: 0.2 }
                  }}
                >
                  <ProductCard product={p} />
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </motion.div>
      </section>

      <button 
        className={`back-to-top ${showTopBtn ? "show" : ""}`} 
        onClick={scrollToTop}
        aria-label="Scroll ke atas"
      >
        ↑
      </button>

      {cartItemCount > 0 && (
        <div className="sticky-cta">
          <div className="sticky-cta-left">
            <div className="sticky-cta-title">Keranjang</div>
            <div className="sticky-cta-value">{cartItemCount} item • {formatIDR(cart.subtotal())}</div>
          </div>
          <Link className="btn" to="/checkout">
            Checkout
          </Link>
        </div>
      )}
    </div>
  );
}