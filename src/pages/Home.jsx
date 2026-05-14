import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

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
    <div className="page home-page">
      <Hero products={products} />

      <section className="section">
        <div className="container">
          <div className="layout-header home-layoutHeader">
            <div>
              <div className="home-kicker">Mulai dari sini</div>
              <h2 className="h2">Paket yang paling sering dipilih</h2>
            </div>
          </div>

          <div className="product-grid-container list-mode home-popularList" role="list" aria-label="Produk populer">
            {loading ? (
              <>
                <div className="catalog-cardSkeleton list" role="listitem" />
                <div className="catalog-cardSkeleton list" role="listitem" />
                <div className="catalog-cardSkeleton list" role="listitem" />
                <div className="catalog-cardSkeleton list" role="listitem" />
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
              <span>Buka semua produk</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
