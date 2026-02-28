import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

import { fetchProductBySlug } from "../lib/api";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { formatIDR } from "../lib/format";
import { usePageMeta } from "../hooks/usePageMeta";
import EmptyState from "../components/EmptyState";

function StockPill({ stock }) {
  // Selalu tampilkan angka stok (permintaan: jangan hanya "Terbatas").
  // Jika stock null/undefined, anggap 0 agar UI tetap konsisten.
  const n = Number(stock ?? 0);
  const safe = Number.isFinite(n) ? n : 0;

  if (safe <= 0) return <span className="stock-pill out">Stok 0</span>;

  const cls = safe <= 5 ? "low" : safe <= 20 ? "mid" : "ok";
  return <span className={`stock-pill ${cls}`}>Stok {safe}</span>;
}

export default function ProductDetail() {
  const nav = useNavigate();
  const { slug } = useParams();
  const toast = useToast();
  const { add } = useCart();

  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState(null);
  const [error, setError] = useState("");

  usePageMeta({
    title: product?.name ? `${product.name} • Detail Produk` : "Detail Produk",
    description: product?.description || "Lihat detail produk dan pilih paket.",
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const data = await fetchProductBySlug(slug);
        if (!alive) return;
        setProduct(data);
      } catch (e) {
        console.warn(e);
        if (!alive) return;
        setError("Produk tidak ditemukan atau gagal dimuat.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [slug]);

  const variants = useMemo(() => {
    return (product?.product_variants || [])
      .slice()
      .filter((v) => v?.is_active)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }, [product]);

  const icon = product?.icon_url;

  function handleAdd(variant) {
    const stock = variant.stock ?? 999;

    if (stock === 0) {
      toast.error("Produk ini sedang habis", { title: variant.name, duration: 2500 });
      return;
    }

    add(
      {
        ...variant,
        product_id: product.id,
        product_name: product.name,
      },
      1
    );

    toast.success(`${variant.name} • ${formatIDR(variant.price_idr)}`, {
      title: "✓ Ditambahkan ke keranjang",
      duration: 2200,
    });
  }

  const pageVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 },
  };

  if (loading) {
    return (
      <div className="page">
        <section className="section">
          <div className="container">
            <div className="card pad">Memuat detail produk…</div>
          </div>
        </section>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="page">
        <section className="section">
          <div className="container">
            <div className="card pad">
              <EmptyState
                icon="🔎"
                title="Produk tidak ditemukan"
                description={error || "Produk tidak tersedia."}
                primaryAction={{ label: "Kembali ke Produk", onClick: () => nav("/produk") }}
              />
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page">
      <section className="section">
        <div className="container">
          <Link to="/produk" className="back-link">
            ← Kembali ke daftar produk
          </Link>

          <motion.div className="product-detail" variants={pageVariants} initial="hidden" animate="show">
            <div className="product-detail-hero">
              <div className="product-detail-left">
                <div className="product-detail-icon">
                  {icon ? (
                    <img src={icon} alt={`${product.name} icon`} />
                  ) : (
                    <div className="product-detail-icon-fallback">{String(product.name || "P").slice(0, 1).toUpperCase()}</div>
                  )}
                </div>

                <div>
                  <h1 className="product-detail-title">{product.name}</h1>
                  {product.description ? <p className="product-detail-desc">{product.description}</p> : null}
                </div>
              </div>

              <div className="product-detail-right">
                <div className="detail-note">
                  <div className="detail-note-title">Cara beli</div>
                  <ol className="detail-note-steps">
                    <li>Pilih paket yang kamu mau</li>
                    <li>Tambah ke keranjang</li>
                    <li>Checkout & bayar QRIS</li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="divider" />

            <div className="variants-head">
              <h2 className="h2">Pilih Paket</h2>
              <div className="muted">Klik “Tambah” untuk memasukkan paket ke keranjang.</div>
            </div>

            <div className="variants-grid">
              <AnimatePresence>
                {variants.map((v) => {
                  const stock = v.stock ?? 999;
                  const out = stock === 0;

                  return (
                    <motion.div
                      key={v.id}
                      className={"variant-tile " + (out ? "disabled" : "")}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 12 }}
                      transition={{ duration: 0.22 }}
                    >
                      <div className="variant-tile-top">
                        <div>
                          <div className="variant-title-row">
                            <div className="variant-title">{v.name}</div>
                            <StockPill stock={v.stock} />
                          </div>
                          <div className="variant-meta">
                            <span className="variant-duration">{v.duration_label}</span>
                            {v.guarantee_text ? <span className="variant-guarantee">• {v.guarantee_text}</span> : null}
                          </div>

                          {v.description ? <div className="variant-desc">{v.description}</div> : null}
                        </div>

                        <div className="variant-price">{formatIDR(v.price_idr)}</div>
                      </div>

                      <button
                        className={"btn btn-sm variant-add " + (out ? "btn-disabled" : "")}
                        type="button"
                        onClick={() => handleAdd(v)}
                        disabled={out}
                      >
                        {out ? "Habis" : "Tambah"}
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {variants.length === 0 ? (
                <div className="card pad">
                  <EmptyState
                    icon="📦"
                    title="Belum ada paket"
                    description="Admin belum menambahkan varian/paket untuk produk ini."
                  />
                </div>
              ) : null}
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
