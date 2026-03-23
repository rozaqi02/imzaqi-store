import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Clock3,
  Minus,
  Package,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Zap,
} from "lucide-react";

import { fetchProductBySlug } from "../lib/api";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { formatIDR } from "../lib/format";
import { usePageMeta } from "../hooks/usePageMeta";
import EmptyState from "../components/EmptyState";

function StockPill({ stock }) {
  const n = Number(stock ?? 0);
  const safe = Number.isFinite(n) ? n : 0;

  if (safe <= 0) return <span className="stock-pill out">0</span>;

  const cls = safe <= 5 ? "low" : safe <= 20 ? "mid" : "ok";
  return <span className={`stock-pill ${cls}`}>{safe}</span>;
}

export default function ProductDetail() {
  const nav = useNavigate();
  const { slug } = useParams();
  const toast = useToast();
  const { add } = useCart();

  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState(null);
  const [error, setError] = useState("");
  const [qtyById, setQtyById] = useState({});

  usePageMeta({
    title: product?.name ? `${product.name} | Detail Produk` : "Detail Produk",
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

  const summary = useMemo(() => {
    const prices = variants
      .map((v) => Number(v?.price_idr || 0))
      .filter((n) => Number.isFinite(n) && n > 0);

    const totalStock = variants.reduce((sum, item) => sum + Number(item?.stock || 0), 0);
    const withGuarantee = variants.filter((item) => item?.guarantee_text).length;

    return {
      minPrice: prices.length ? Math.min(...prices) : 0,
      maxPrice: prices.length ? Math.max(...prices) : 0,
      totalStock,
      withGuarantee,
    };
  }, [variants]);

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

    toast.success(`${variant.name} | ${formatIDR(variant.price_idr)}`, {
      title: "Masuk keranjang",
      duration: 2200,
    });

    setQty(variant, 1);
  }

  const icon = product?.icon_url;
  const summaryCards = [
    {
      icon: Package,
      value: variants.length,
      label: "Paket",
      iconClass: "is-package",
    },
    {
      icon: Zap,
      value: summary.totalStock,
      label: "Stok",
      iconClass: "is-stock",
    },
    {
      icon: ShieldCheck,
      value: summary.withGuarantee,
      label: "Garansi",
      iconClass: "is-guarantee",
    },
  ];

  if (loading) {
    return (
      <div className="page">
        <section className="section">
          <div className="container">
            <div className="card pad">Memuat detail produk...</div>
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
                icon="?"
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
            <ArrowLeft size={16} />
            <span>Kembali</span>
          </Link>

          <motion.div
            className="product-detail"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="product-detail-hero">
              <div className="product-detail-main">
                <div className="product-detail-brand">
                  <div className="product-detail-icon">
                    {icon ? (
                      <img src={icon} alt={`${product.name} icon`} />
                    ) : (
                      <div className="product-detail-icon-fallback">
                        {String(product.name || "P").slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="product-detail-copy">
                    <h1 className="product-detail-title">{product.name}</h1>
                    {product.description ? (
                      <p className="product-detail-desc">{product.description}</p>
                    ) : null}
                  </div>
                </div>

                <div className="product-detail-band">
                  <div className="product-detail-range">
                    {summary.minPrice && summary.maxPrice && summary.minPrice !== summary.maxPrice
                      ? `${formatIDR(summary.minPrice)} - ${formatIDR(summary.maxPrice)}`
                      : summary.minPrice
                        ? formatIDR(summary.minPrice)
                        : "-"}
                  </div>

                  <div className="product-detail-summary">
                    {summaryCards.map((item) => {
                      const Icon = item.icon;
                      return (
                        <div key={item.label} className="product-detail-summaryCard">
                          <span className={`product-detail-summaryIcon ${item.iconClass || ""}`}>
                            <Icon size={15} />
                          </span>
                          <div>
                            <strong>{item.value}</strong>
                            <span>{item.label}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="detail-flow">
                <div className="detail-flowItem active">
                  <span>1</span>
                  <small>Pilih</small>
                </div>
                <div className="detail-flowLine" />
                <div className="detail-flowItem">
                  <span>2</span>
                  <small>Bayar</small>
                </div>
                <div className="detail-flowLine" />
                <div className="detail-flowItem">
                  <span>3</span>
                  <small>Status</small>
                </div>
              </div>
            </div>

            <div className="divider" />

            <div className="variants-head">
              <div>
                <h2 className="h2">Pilih varian</h2>
              </div>
              <div className="variants-count">{variants.length} pilihan</div>
            </div>

            <div className="variants-grid">
              <AnimatePresence>
                {variants.map((v, idx) => {
                  const stock = Number(v.stock ?? 0);
                  const out = stock === 0;
                  const qty = getQty(v);
                  const maxQty = getMaxQty(v);
                  const canDec = qty > 1;
                  const canInc = qty < maxQty;
                  const stockLevel = out ? 0 : Math.min(100, Math.max(10, stock * 10));

                  return (
                    <motion.article
                      key={v.id}
                      className={`variant-tile ${out ? "disabled" : ""}`}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 14 }}
                      transition={{ duration: 0.28, delay: idx * 0.04 }}
                    >
                      <div className="variant-head">
                        <div>
                          <div className="variant-titleRow">
                            <div className="variant-title">{v.name}</div>
                            <StockPill stock={v.stock} />
                          </div>

                          <div className="variant-facts">
                            <span className="variant-chip">
                              <Clock3 size={13} />
                              <span>{v.duration_label}</span>
                            </span>
                            {v.guarantee_text ? (
                              <span className="variant-chip">
                                <ShieldCheck size={13} />
                                <span>{v.guarantee_text}</span>
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="variant-priceWrap">
                          <div className="variant-price">{formatIDR(v.price_idr)}</div>
                          <div className="variant-subPrice">per paket</div>
                        </div>
                      </div>

                      {v.description ? <div className="variant-desc">{v.description}</div> : null}

                      <div className="variant-stockRail" aria-hidden="true">
                        <span style={{ width: `${stockLevel}%` }} />
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
                            <Minus size={14} />
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
                            <Plus size={14} />
                          </button>
                        </div>

                        <button
                          className={`btn btn-sm variant-add ${out ? "btn-disabled" : ""}`}
                          type="button"
                          onClick={() => handleAdd(v, qty)}
                          disabled={out}
                        >
                          <ShoppingCart size={14} />
                          <span>{out ? "Habis" : qty > 1 ? `Tambah x${qty}` : "Tambah"}</span>
                        </button>
                      </div>
                    </motion.article>
                  );
                })}
              </AnimatePresence>

              {variants.length === 0 ? (
                <div className="card pad">
                  <EmptyState
                    icon="-"
                    title="Belum ada paket"
                    description="Admin belum menambahkan varian untuk produk ini."
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
