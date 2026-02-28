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

  // Qty selector per varian (permintaan: ada opsi - / + pada jumlah belanjaan)
  const [qtyById, setQtyById] = useState({});

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

  function getMaxQty(variant) {
    const s = Number(variant?.stock ?? 0);
    if (!Number.isFinite(s)) return 99;
    if (s <= 0) return 1;
    return Math.min(99, s);
  }

  function getQty(variant) {
    const q = Number(qtyById?.[variant.id] ?? 1);
    if (!Number.isFinite(q)) return 1;
    return Math.max(1, Math.min(getMaxQty(variant), q));
  }

  function setQty(variant, next) {
    const max = getMaxQty(variant);
    const safe = Math.max(1, Math.min(max, Number(next) || 1));
    setQtyById((prev) => ({ ...prev, [variant.id]: safe }));
  }

  const icon = product?.icon_url;

  function handleAdd(variant, qty = 1) {
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
      qty
    );

    toast.success(`${variant.name} • ${formatIDR(variant.price_idr)}`, {
      title: "✓ Ditambahkan ke keranjang",
      duration: 2200,
    });

    // Reset qty agar tidak "kecolongan" saat pindah varian
    setQty(variant, 1);
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
                  const qty = getQty(v);
                  const maxQty = getMaxQty(v);
                  const canDec = qty > 1;
                  const canInc = qty < maxQty;

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

                      <div className="variant-foot">
                        <div className="variant-qty" aria-label={`Jumlah untuk ${v.name}`}>
                          <button
                            type="button"
                            className="qty-btn"
                            onClick={() => setQty(v, qty - 1)}
                            disabled={out || !canDec}
                            aria-label="Kurangi jumlah"
                          >
                            −
                          </button>
                          <div className="qty-num" aria-label="Jumlah">
                            {qty}
                          </div>
                          <button
                            type="button"
                            className="qty-btn"
                            onClick={() => setQty(v, qty + 1)}
                            disabled={out || !canInc}
                            aria-label="Tambah jumlah"
                          >
                            +
                          </button>
                        </div>

                        <button
                          className={"btn btn-sm variant-add " + (out ? "btn-disabled" : "")}
                          type="button"
                          onClick={() => handleAdd(v, qty)}
                          disabled={out}
                        >
                          {out ? "Habis" : qty > 1 ? `Tambah (${qty})` : "Tambah"}
                        </button>
                      </div>
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
