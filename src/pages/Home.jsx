import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CreditCard, LayoutGrid, Rows3, ShieldCheck, Sparkles } from "lucide-react";

import FlowAssist from "../components/FlowAssist";
import Hero from "../components/Hero";
import ProductTile from "../components/ProductTile";
import { fetchProducts, fetchTopSellingIds } from "../lib/api";
import { formatIDR } from "../lib/format";
import { buildStoreInsights } from "../lib/storeInsights";
import EmptyState from "../components/EmptyState";
import { usePageMeta } from "../hooks/usePageMeta";
import { useCart } from "../context/CartContext";

export default function Home() {
  const cart = useCart();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [topIds, setTopIds] = useState([]);
  const [error, setError] = useState("");
  const [layout, setLayout] = useState("grid");

  usePageMeta({
    title: "Home",
    description: "Premium apps cepat, ringkas, dan mudah dipilih.",
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [data, ranking] = await Promise.all([fetchProducts(), fetchTopSellingIds()]);
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

    return () => {
      alive = false;
    };
  }, []);

  const popularProducts = useMemo(() => {
    if (products.length === 0) return [];

    const sorted = [...products].sort((a, b) => {
      const rankA = topIds.indexOf(a.id);
      const rankB = topIds.indexOf(b.id);

      if (rankA !== -1 && rankB === -1) return -1;
      if (rankA === -1 && rankB !== -1) return 1;
      if (rankA !== -1 && rankB !== -1) return rankA - rankB;

      return a.sort_order - b.sort_order;
    });

    return sorted.slice(0, 4);
  }, [products, topIds]);

  const insights = useMemo(() => buildStoreInsights({ products }), [products]);

  const cartCount = useMemo(
    () => cart.items.reduce((sum, item) => sum + Number(item.qty || 0), 0),
    [cart.items]
  );

  return (
    <div className="page home-page">
      <Hero />

      <section className="section">
        <div className="container">
          <FlowAssist
            eyebrow="Start cepat"
            title="Ambil terlaris. Checkout. Simpan ID."
            description="Masuk lewat yang paling ramai."
            badges={[
              insights.topProduct
                ? { label: `Top: ${insights.topProduct.name}`, icon: <Sparkles size={13} /> }
                : { label: `${insights.productCount} produk aktif`, icon: <Sparkles size={13} /> },
              cartCount > 0 ? { label: `${cartCount} di bag`, tone: "emphasis" } : "Checkout siap",
              insights.topCategory
                ? { label: `${insights.topCategory.label} ramai`, icon: <ShieldCheck size={13} /> }
                : { label: "Status siap", icon: <ShieldCheck size={13} /> },
            ]}
            actions={[
              { label: "Katalog", to: "/produk" },
              cartCount > 0
                ? { label: "Checkout", to: "/checkout", ghost: true, icon: <CreditCard size={14} /> }
                : { label: "Status", to: "/status", ghost: true, icon: <ArrowRight size={14} /> },
            ]}
            className="home-flowAssist reveal"
          />

          <div className="layout-header home-layoutHeader">
            <div>
              <div className="home-kicker">Mulai dari sini</div>
              <h2 className="h2">Paket yang paling sering dipilih</h2>
            </div>

            <div className="layout-toggles" aria-label="Ubah tampilan">
              <button
                className={`toggle-btn ${layout === "grid" ? "active" : ""}`}
                onClick={() => setLayout("grid")}
                title="Grid"
                aria-label="Grid"
              >
                <LayoutGrid size={18} />
              </button>
              <button
                className={`toggle-btn ${layout === "list" ? "active" : ""}`}
                onClick={() => setLayout("list")}
                title="List"
                aria-label="List"
              >
                <Rows3 size={18} />
              </button>
            </div>
          </div>

          <p className="home-summaryText">
            {insights.productCount
              ? `${insights.productCount} produk aktif, harga mulai ${formatIDR(insights.minPrice)}, dan ${
                  insights.lowStockCount ? `${insights.lowStockCount} varian stok tipis` : "stok aman untuk banyak pilihan"
                }.`
              : "Empat pilihan ini biasanya jadi titik mulai paling aman kalau kamu masih membandingkan paket."}
          </p>

          <div className={`product-grid-container ${layout === "grid" ? "grid-mode" : "list-mode"}`}>
            {loading ? (
              <>
                <div className="skeleton card" />
                <div className="skeleton card" />
                <div className="skeleton card" />
                <div className="skeleton card" />
              </>
            ) : error ? (
              <div className="card pad" style={{ gridColumn: "1 / -1" }}>
                <EmptyState icon="!" title="Gagal memuat" description={error} />
              </div>
            ) : popularProducts.length === 0 ? (
              <div className="card pad" style={{ gridColumn: "1 / -1" }}>
                <EmptyState icon="-" title="Belum ada produk aktif" />
              </div>
            ) : (
              popularProducts.map((p) => <ProductTile key={p.id} product={p} layout={layout} />)
            )}
          </div>

          <div className="home-bottomCta">
            <Link className="btn btn-ghost" to="/produk">
              <span>Buka semua produk</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
