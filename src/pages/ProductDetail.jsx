import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Clock3, Minus, Plus, ShieldCheck, ShoppingCart, Sparkles } from "lucide-react";

import { fetchProductBySlug } from "../lib/api";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { formatIDR } from "../lib/format";
import { usePageMeta } from "../hooks/usePageMeta";
import EmptyState from "../components/EmptyState";

function normalizeLines(text) {
  return String(text || "")
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function uniqueNonEmpty(values) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}


function parseDays(label) {
  const match = String(label || "").match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function pickRecommendedVariant(variants) {
  const source = variants.filter((variant) => Number(variant?.stock || 0) > 0);
  const target = source.length ? source : variants;
  if (!target.length) return null;

  return target
    .slice()
    .sort((a, b) => {
      const priceDiff = Number(a?.price_idr || 0) - Number(b?.price_idr || 0);
      if (priceDiff !== 0) return priceDiff;

      const dayDiff = parseDays(b?.duration_label) - parseDays(a?.duration_label);
      if (dayDiff !== 0) return dayDiff;

      return Number(b?.stock || 0) - Number(a?.stock || 0);
    })[0]?.id;
}

function formatPriceRange(min, max) {
  if (!min && !max) return "-";
  if (min && max && min !== max) return `${formatIDR(min)} - ${formatIDR(max)}`;
  return formatIDR(min || max);
}


function deriveDurationSummary(variants) {
  const durations = uniqueNonEmpty(variants.map((variant) => variant?.duration_label));
  if (!durations.length) return "Durasi fleksibel";
  if (durations.length === 1) return durations[0];
  if (durations.length === 2) return `${durations[0]} / ${durations[1]}`;
  return `${durations[0]} +${durations.length - 1} opsi`;
}

function deriveGuaranteeSummary(variants) {
  const guarantees = uniqueNonEmpty(variants.map((variant) => variant?.guarantee_text));
  return guarantees[0] || "Garansi admin";
}

function StockPill({ stock }) {
  const value = Number(stock ?? 0);
  const safe = Number.isFinite(value) ? value : 0;

  if (safe <= 0) return <span className="stock-pill out">Stok: 0</span>;

  const tone = safe <= 5 ? "low" : safe <= 20 ? "mid" : "ok";
  return <span className={`stock-pill ${tone}`}>Stok: {safe}</span>;
}

export default function ProductDetail() {
  const nav = useNavigate();
  const { slug } = useParams();
  const toast = useToast();
  const cart = useCart();
  const { add } = cart;
  const reduceMotion = useReducedMotion();

  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState(null);
  const [error, setError] = useState("");
  const [qtyById, setQtyById] = useState({});

  usePageMeta({
    title: product?.name ? `${product.name} | Detail Produk` : "Detail Produk",
    description: product?.description || "Buka detail produk, pilih paket, lalu lanjutkan ke checkout.",
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
      } catch (fetchError) {
        console.warn(fetchError);
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

  const variants = useMemo(
    () =>
      (product?.product_variants || [])
        .slice()
        .filter((variant) => variant?.is_active)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    [product]
  );

  const summary = useMemo(() => {
    const prices = variants
      .map((variant) => Number(variant?.price_idr || 0))
      .filter((value) => Number.isFinite(value) && value > 0);

    const totalStock = variants.reduce((sum, variant) => sum + Number(variant?.stock || 0), 0);

    return {
      minPrice: prices.length ? Math.min(...prices) : 0,
      maxPrice: prices.length ? Math.max(...prices) : 0,
      totalStock,
    };
  }, [variants]);

  function getMaxQty(variant) {
    const stock = Number(variant?.stock ?? 0);
    if (!Number.isFinite(stock)) return 99;
    if (stock <= 0) return 1;
    return Math.min(99, stock);
  }

  function getQty(variant) {
    const quantity = Number(qtyById?.[variant.id] ?? 1);
    if (!Number.isFinite(quantity)) return 1;
    return Math.max(1, Math.min(getMaxQty(variant), quantity));
  }

  function setQty(variant, next) {
    const maxQty = getMaxQty(variant);
    const safeQty = Math.max(1, Math.min(maxQty, Number(next) || 1));
    setQtyById((prev) => ({ ...prev, [variant.id]: safeQty }));
  }

  function handleAdd(variant, qty = 1) {
    const stock = Number(variant?.stock ?? 999);

    if (stock <= 0) {
      toast.error("Produk ini sedang habis", { title: variant.name, duration: 2500 });
      return;
    }

    add(
      {
        ...variant,
        product_id: product.id,
        product_name: product.name,
        product_icon_url: product.icon_url || "",
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
  const durationSummary = useMemo(() => deriveDurationSummary(variants), [variants]);
  const guaranteeSummary = useMemo(() => deriveGuaranteeSummary(variants), [variants]);
  const recommendedVariantId = useMemo(() => pickRecommendedVariant(variants), [variants]);

  const heroBadges = useMemo(
    () => [
      { key: "duration", icon: Clock3, text: durationSummary || "-" },
      { key: "guarantee", icon: ShieldCheck, text: guaranteeSummary || "Garansi admin" },
    ],
    [durationSummary, guaranteeSummary]
  );

  const productDescriptionBubble = useMemo(
    () => {
      const lines = normalizeLines(product?.description);
      if (!lines.length) return "Pilih paket yang cocok lalu lanjut checkout.";
      return lines.slice(0, 2).join("\n");
    },
    [product?.description]
  );

  if (loading) {
    return (
      <div className="page">
        <section className="section">
          <div className="container">
            <div className="product-detail-loading">
              <div className="product-detail-loadingLine w-34" />
              <div className="product-detail-loadingLine w-62" />
              <div className="product-detail-loadingGrid">
                <div className="product-detail-loadingBlock" />
                <div className="product-detail-loadingBlock" />
              </div>
            </div>
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
                primaryAction={{ label: "Kembali ke katalog", onClick: () => nav("/produk") }}
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
            <span>Kembali ke katalog</span>
          </Link>

          <motion.div
            className="product-detail"
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { duration: 0.34, ease: [0.22, 1, 0.36, 1] }
            }
          >
            <div className="product-detail-shell">
              <div className="product-detail-main">
                <div className="product-detail-brand">
                  <div className="product-detail-icon">
                    {icon ? (
                      <img src={icon} alt={`${product.name} icon`} loading="lazy" decoding="async" />
                    ) : (
                      <div className="product-detail-icon-fallback">
                        {String(product.name || "P").slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="product-detail-copy">
                    <div className="product-detail-metaRow">
                      {heroBadges.map((badge) => {
                        const Icon = badge.icon;
                        return (
                          <span key={badge.key} className="product-detail-metaPill">
                            <Icon size={13} />
                            <span>{badge.text}</span>
                          </span>
                        );
                      })}
                    </div>

                    <h1 className="product-detail-title">{product.name}</h1>
                    <div className="product-detail-descBubble">{productDescriptionBubble}</div>
                  </div>
                </div>

                <div className="product-detail-priceCard">
                  <div className="product-detail-priceLabel">Mulai dari</div>
                  <div className="product-detail-range">{formatPriceRange(summary.minPrice, summary.maxPrice)}</div>
                  <div className="product-detail-priceHint">Harga varian aktif.</div>
                </div>
              </div>
            </div>

            <div className="divider" />

            <div className="variants-head">
              <div>
                <div className="variants-eyebrow">Varian</div>
                <h2 className="h2">Paket</h2>
              </div>
              <div className="variants-count">{variants.length} paket tersedia</div>
            </div>

            <div className="variants-grid">
              {variants.map((variant) => {
                const stock = Number(variant.stock ?? 0);
                const out = stock <= 0;
                const qty = getQty(variant);
                const maxQty = getMaxQty(variant);
                const canDec = qty > 1;
                const canInc = qty < maxQty;
                const isRecommended = variant.id === recommendedVariantId;
                const descriptionBody = String(
                  variant.description ||
                    (out
                      ? "Slot sedang habis. Cek lagi saat stok terbuka."
                      : "Varian siap diproses setelah pembayaran terverifikasi.")
                )
                  .replace(/\r\n/g, "\n")
                  .trim();
                const factChips = [
                  { key: `duration-${variant.id}`, icon: Clock3, text: variant.duration_label || "-" },
                  { key: `guarantee-${variant.id}`, icon: ShieldCheck, text: variant.guarantee_text || "Garansi admin" },
                ];

                return (
                  <article
                    key={variant.id}
                    className={`variant-tile ${out ? "disabled" : ""} ${
                      isRecommended ? "is-recommended" : ""
                    }`}
                  >
                    <div className="variant-topMeta">
                      <div className="variant-badges">
                        {isRecommended ? (
                          <span className="variant-badge recommend">
                            <Sparkles size={12} />
                            <span>Rekomendasi</span>
                          </span>
                        ) : null}
                      </div>

                      <StockPill stock={variant.stock} />
                    </div>

                    <div className="variant-head">
                      <div>
                        <div className="variant-title">{variant.name}</div>
                        <div className="variant-facts">
                          {factChips.map((chip) => {
                            const Icon = chip.icon;
                            return (
                              <span key={chip.key} className="variant-chip">
                                <Icon size={12} />
                                <span>{chip.text}</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      <div className="variant-priceWrap">
                        <div className="variant-priceLabel">Harga</div>
                        <div className="variant-price">{formatIDR(variant.price_idr)}</div>
                        <div className="variant-subPrice">per paket</div>
                      </div>
                    </div>

                    <div className="variant-notes">
                      <div className="variant-notesTitle">Deskripsi</div>
                      <div className="variant-noteList">
                        <div className="variant-noteBody">{descriptionBody}</div>
                      </div>
                    </div>

                    <div className="variant-foot">
                      <div className="variant-qty" aria-label={`Jumlah untuk ${variant.name}`}>
                        <button
                          type="button"
                          className="qty-btn"
                          onClick={() => setQty(variant, qty - 1)}
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
                          onClick={() => setQty(variant, qty + 1)}
                          disabled={out || !canInc}
                          aria-label="Tambah jumlah"
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      <button
                        className={`btn btn-sm variant-add ${out ? "btn-disabled" : ""}`}
                        type="button"
                        onClick={() => handleAdd(variant, qty)}
                        disabled={out}
                      >
                        <ShoppingCart size={14} />
                        <span>{out ? "Habis" : qty > 1 ? `Tambah x${qty}` : "Tambah"}</span>
                      </button>
                    </div>
                  </article>
                );
              })}

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
