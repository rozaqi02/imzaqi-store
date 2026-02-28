import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
// Framer Motion DIHAPUS agar stabil

import Hero from "../components/Hero";
import ProductTile from "../components/ProductTile";
import { fetchProducts, fetchTopSellingIds } from "../lib/api";
import EmptyState from "../components/EmptyState";
import { usePageMeta } from "../hooks/usePageMeta";

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [topIds, setTopIds] = useState([]);
  const [error, setError] = useState("");
  const [layout, setLayout] = useState("grid");

  usePageMeta({
    title: "Home",
    description: "Hidden gem aplikasi premium murah + bergaransi.",
  });

  // Fetch Data
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [data, ranking] = await Promise.all([
          fetchProducts(),
          fetchTopSellingIds()
        ]);
        
        if (!alive) return;
        setProducts(data);
        setTopIds(ranking);
      } catch (e) {
        console.warn(e);
        setError("Gagal memuat produk.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Logika Produk Populer (LIMIT 3)
  const popularProducts = useMemo(() => {
    if (products.length === 0) return [];
    
    const sorted = [...products].sort((a, b) => {
      const rankA = topIds.indexOf(a.id);
      const rankB = topIds.indexOf(b.id);

      // Prioritaskan yang ada di ranking
      if (rankA !== -1 && rankB === -1) return -1;
      if (rankA === -1 && rankB !== -1) return 1;
      if (rankA !== -1 && rankB !== -1) return rankA - rankB;
      
      // Fallback ke sort_order default
      return a.sort_order - b.sort_order;
    });

    return sorted.slice(0, 3);
  }, [products, topIds]);

  return (
    <div className="page">
      <Hero />

      <section className="section">
        <div className="container">
          
          {/* Header Section */}
          <div className="layout-header">
            <div>
              <h2 className="h2">Produk Terlaris 🔥</h2>
              <p className="muted">Top 3 produk paling banyak dicari bulan ini.</p>
            </div>
            
            {/* Toggle Buttons (Standard HTML Button) */}
            <div className="layout-toggles">
              <button 
                className={`toggle-btn ${layout === 'grid' ? 'active' : ''}`}
                onClick={() => setLayout('grid')}
                title="Grid View"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
              </button>
              <button 
                className={`toggle-btn ${layout === 'list' ? 'active' : ''}`}
                onClick={() => setLayout('list')}
                title="List View"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
              </button>
            </div>
          </div>

          {/* GRID UTAMA (Standard Div) */}
          <div className={`product-grid-container ${layout === 'grid' ? 'grid-mode' : 'list-mode'}`}>
            {loading ? (
              // Skeleton (3 biji)
              <>
                <div className="skeleton card" />
                <div className="skeleton card" />
                <div className="skeleton card" />
              </>
            ) : error ? (
              <div className="card pad" style={{ gridColumn: "1 / -1" }}>
                <EmptyState icon="📡" title="Gagal memuat" description={error} />
              </div>
            ) : popularProducts.length === 0 ? (
              <div className="card pad" style={{ gridColumn: "1 / -1" }}>
                <EmptyState icon="🛍️" title="Belum ada produk aktif" />
              </div>
            ) : (
              // Render Produk
              popularProducts.map((p) => (
                <ProductTile key={p.id} product={p} />
              ))
            )}
          </div>

          <div style={{ marginTop: 32, textAlign: 'center' }}>
            <Link className="btn btn-ghost" to="/produk">Lihat semua produk →</Link>
          </div>
        </div>
      </section>

      {/* Info Strip */}
      <section className="section">
        <div className="container info-strip">
          <div className="info-item">
            <div className="info-title">Checkout QRIS</div>
            <div className="info-sub">Bayar cepat, bukti bayar langsung lanjut WhatsApp.</div>
          </div>
          <div className="info-item">
            <div className="info-title">Garansi jelas</div>
            <div className="info-sub">Sesuai paket. Detail ada di setiap varian.</div>
          </div>
          <div className="info-item">
            <div className="info-title">Harga selalu terbaru</div>
            <div className="info-sub">Pricelist diperbarui berkala. Selalu dapat harga terkini.</div>
          </div>
        </div>
      </section>
    </div>
  );
}