import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, CreditCard, LayoutGrid, Rows3, ShieldCheck } from "lucide-react";

import Hero from "../components/Hero";
import ProductTile from "../components/ProductTile";
import { fetchProducts, fetchTopSellingIds } from "../lib/api";
import EmptyState from "../components/EmptyState";
import { usePageMeta } from "../hooks/usePageMeta";

const SIGNALS = [
  {
    icon: CreditCard,
    title: "QRIS",
    text: "Scan and pay",
  },
  {
    icon: ShieldCheck,
    title: "Garansi",
    text: "Sesuai paket",
  },
  {
    icon: BadgeCheck,
    title: "Status",
    text: "Track by code",
  },
];

export default function Home() {
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

  return (
    <div className="page">
      <Hero />

      <section className="section">
        <div className="container">
          <div className="home-strip">
            {SIGNALS.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="home-stripCard">
                  <span className="home-stripIcon">
                    <Icon size={16} />
                  </span>
                  <div>
                    <div className="home-stripTitle">{item.title}</div>
                    <div className="home-stripText">{item.text}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="layout-header home-layoutHeader">
            <div>
              <div className="home-kicker">Top picks</div>
              <h2 className="h2">Paling dicari</h2>
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

          <p className="home-summaryText">{popularProducts.length || 4} produk cepat pilih.</p>

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
              popularProducts.map((p) => <ProductTile key={p.id} product={p} />)
            )}
          </div>

          <div className="home-bottomCta">
            <Link className="btn btn-ghost" to="/produk">
              <span>Lihat semua</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
