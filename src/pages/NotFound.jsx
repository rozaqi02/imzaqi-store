import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "../css/pages/NotFound.css";
import {
  Activity,
  ArrowRight,
  Grid2x2,
  History,
  Home,
  MapPinOff,
  MessageCircle,
  Search,
} from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";
import { fetchProducts } from "../lib/api";
import ProductTile from "../components/ProductTile";

const QUICK_LINKS = [
  { to: "/", label: "Beranda", icon: Home, desc: "Kembali ke halaman utama" },
  { to: "/produk", label: "Katalog", icon: Grid2x2, desc: "Browse semua produk" },
  { to: "/status", label: "Status Order", icon: Activity, desc: "Cek progress pesanan" },
  { to: "/status?tab=riwayat", label: "Riwayat", icon: History, desc: "Order di browser ini" },
];

export default function NotFound() {
  const [products, setProducts] = useState([]);

  usePageMeta({
    title: "404 - Halaman Tidak Ditemukan",
    description: "Halaman ini nggak ada. Coba pilih halaman lain ya.",
  });

  useEffect(() => {
    let alive = true;
    fetchProducts({ useCache: true })
      .then((rows) => {
        if (alive) setProducts(rows || []);
      })
      .catch(() => {
        if (alive) setProducts([]);
      });
    return () => {
      alive = false;
    };
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
    scored.sort(
      (a, b) => b.sold - a.sold || (a.product.sort_order || 0) - (b.product.sort_order || 0)
    );
    return scored.slice(0, 4).map((row) => row.product);
  }, [products]);

  return (
    <div className="page nf-page">
      <section className="section nf-section">
        <div className="container">
          <div className="nf-layout">
            <div className="nf-card nf-heroCard">
              <div className="nf-badgeRow">
                <span className="nf-badge">Error 404</span>
              </div>

              <div className="nf-visual" aria-hidden="true">
                <div className="nf-orbit nf-orbit--outer" />
                <div className="nf-orbit nf-orbit--inner" />
                <div className="nf-visualCore">
                  <MapPinOff size={28} strokeWidth={2.1} />
                </div>
              </div>

              <p className="nf-kicker">Ups, nyasar</p>
              <h1 className="nf-title">Halaman ini nggak ketemu</h1>
              <p className="nf-sub">
                Link mungkin salah ketik, sudah dipindah, atau memang belum ada.
                Santai — pilih tujuan di bawah atau loncat ke katalog.
              </p>

              <div className="nf-ctaRow">
                <Link to="/produk" className="btn nf-ctaPrimary">
                  <Search size={16} />
                  Jelajah katalog
                </Link>
                <Link to="/" className="btn btn-ghost nf-ctaGhost">
                  <Home size={16} />
                  Ke beranda
                </Link>
              </div>
            </div>

            <div className="nf-card nf-linksCard">
              <div className="nf-linksHead">
                <h2 className="nf-linksTitle">Pintasan cepat</h2>
                <p className="nf-linksSub">Ke halaman yang sering dipakai</p>
              </div>

              <div className="nf-links">
                {QUICK_LINKS.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link key={link.to} to={link.to} className="nf-linkCard">
                      <span className="nf-linkIcon" aria-hidden="true">
                        <Icon size={18} strokeWidth={2.15} />
                      </span>
                      <span className="nf-linkCopy">
                        <strong>{link.label}</strong>
                        <small>{link.desc}</small>
                      </span>
                      <ArrowRight size={16} className="nf-linkArrow" aria-hidden="true" />
                    </Link>
                  );
                })}
              </div>

              <Link className="nf-helpLink" to="/status">
                <MessageCircle size={15} />
                Cek status order / butuh bantuan
              </Link>
            </div>
          </div>

          {popularProducts.length > 0 ? (
            <div className="nf-popular">
              <div className="nf-popularHead">
                <div>
                  <p className="nf-popularKicker">Sambil di sini</p>
                  <h2 className="nf-popularTitle">Produk yang lagi rame</h2>
                </div>
                <Link to="/produk" className="nf-popularAll">
                  Lihat semua
                  <ArrowRight size={14} />
                </Link>
              </div>
              <div className="product-grid-container grid-mode nf-popularGrid" role="list">
                {popularProducts.map((product, idx) => (
                  <ProductTile
                    key={product.id}
                    product={product}
                    layout="grid"
                    rank={idx + 1}
                    disableTilt
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
