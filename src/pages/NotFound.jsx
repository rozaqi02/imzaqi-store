import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowRight, Compass, Grid2x2, History, Home } from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";
import { fetchProducts } from "../lib/api";
import ProductTile from "../components/ProductTile";

const QUICK_LINKS = [
  { to: "/", label: "Beranda", icon: Home, desc: "Balik ke beranda" },
  { to: "/produk", label: "Produk", icon: Grid2x2, desc: "Lihat semua katalog" },
  { to: "/status", label: "Status Order", icon: Activity, desc: "Cek progress order kamu" },
  { to: "/status?tab=riwayat", label: "Riwayat", icon: History, desc: "Order dari browser ini" },
];

export default function NotFound() {
  const [products, setProducts] = useState([]);

  usePageMeta({
    title: "404 — Halaman Tidak Ditemukan",
    description: "Halaman ini nggak ada. Coba pilih halaman lain ya.",
  });

  useEffect(() => {
    let alive = true;
    fetchProducts({ useCache: true })
      .then((rows) => { if (alive) setProducts(rows || []); })
      .catch(() => { if (alive) setProducts([]); });
    return () => { alive = false; };
  }, []);

  const popularProducts = useMemo(() => {
    if (!products.length) return [];
    const scored = [...products].map((product) => {
      const sold = (product?.product_variants || []).reduce(
        (sum, variant) => sum + Number(variant?.sold_count || 0),
        0
      );
      return { product, sold };
    });
    scored.sort((a, b) => b.sold - a.sold || (a.product.sort_order || 0) - (b.product.sort_order || 0));
    return scored.slice(0, 4).map((row) => row.product);
  }, [products]);

  return (
    <div className="page nf-page">
      <section className="section">
        <div className="container">
          <div className="nf-shell">
            <div className="nf-hero">
              <div className="nf-radar">
                <Compass size={32} />
              </div>
              <div className="nf-code">404</div>
              <h1 className="nf-title">Halaman hilang nih</h1>
              <p className="nf-sub">
                Link-nya nggak ada atau udah dipindah.
                Pilih salah satu halaman di bawah ya.
              </p>
            </div>

            <div className="nf-links">
              {QUICK_LINKS.map((link) => {
                const Icon = link.icon;
                return (
                  <Link key={link.to} to={link.to} className="nf-linkCard">
                    <span className="nf-linkIcon">
                      <Icon size={20} />
                    </span>
                    <div className="nf-linkCopy">
                      <strong>{link.label}</strong>
                      <small>{link.desc}</small>
                    </div>
                    <ArrowRight size={16} className="nf-linkArrow" />
                  </Link>
                );
              })}
            </div>

            {popularProducts.length > 0 ? (
              <div className="nf-popular">
                <h2 className="h3">Produk populer</h2>
                <div className="product-grid-container grid-mode" role="list">
                  {popularProducts.map((product, idx) => (
                    <ProductTile key={product.id} product={product} layout="grid" rank={idx + 1} disableTilt />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}