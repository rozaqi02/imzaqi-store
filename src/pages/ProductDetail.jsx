import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ChevronRight, Minus, Plus, ShoppingCart, Sparkles } from "lucide-react";

import { fetchProductBySlug } from "../lib/api";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { formatIDR } from "../lib/format";
import { usePageMeta } from "../hooks/usePageMeta";
import EmptyState from "../components/EmptyState";

const CHECKOUT_STEPS = [
  { label: "Pilih", helper: "paket" },
  { label: "Atur", helper: "qty" },
  { label: "Bayar", helper: "lanjut" },
];

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

function summarizeCopy(text, fallback) {
  const [firstLine] = normalizeLines(text);
  if (!firstLine) return fallback;
  return firstLine.length > 88 ? `${firstLine.slice(0, 85).trimEnd()}...` : firstLine;
}

function deriveCategoryLabel(product) {
  const raw = String(product?.category || "").trim();
  if (raw) {
    return raw
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  const blob = `${product?.slug || ""} ${product?.name || ""}`.toLowerCase();
  if (/(netflix|disney|hotstar|prime|viu|vidio|iqiyi|bstation|hbo)/.test(blob)) return "Streaming";
  if (/(spotify|youtube)/.test(blob)) return "Music";
  if (/(canva|capcut|chatgpt|zoom|getcontact)/.test(blob)) return "Tools";
  if (/(duolingo)/.test(blob)) return "Belajar";
  return "Digital";
}

function getStockState(stock) {
  const value = Number(stock ?? 0);
  const safe = Number.isFinite(value) ? value : 0;
  if (safe <= 0) return { tone: "out", label: "Habis" };
  if (safe <= 5) return { tone: "low", label: "Terbatas" };
  if (safe <= 20) return { tone: "mid", label: "Aman" };
  return { tone: "ok", label: "Ready" };
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

function deriveAccessLabel(product, variants) {
  const blob = `${product?.description || ""} ${variants
    .map((variant) => `${variant?.name || ""} ${variant?.description || ""}`)
    .join(" ")}`.toLowerCase();

  if (blob.includes("akun buyer")) return "Akun buyer";
  if (blob.includes("akun seller")) return "Akun seller";
  if (blob.includes("private")) return "Private";
  if (blob.includes("sharing")) return "Sharing";
  if (blob.includes("family")) return "Family";
  return "Diproses admin";
}

function deriveDeliveryLabel(product, variants) {
  const blob = `${product?.description || ""} ${variants
    .map((variant) => variant?.description || "")
    .join(" ")}`.toLowerCase();

  if (/(send mail|send email|send e-mail|kirim email)/.test(blob)) return "Kirim via email";
  if (/login/.test(blob)) return "Butuh login";
  return "Follow up admin";
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

function deriveVariantMode(variant) {
  const blob = `${variant?.name || ""} ${variant?.description || ""}`.toLowerCase();
  if (blob.includes("akun buyer")) return "Buyer";
  if (blob.includes("akun seller")) return "Seller";
  if (blob.includes("private")) return "Private";
  if (blob.includes("sharing")) return "Sharing";
  if (blob.includes("family")) return "Family";
  return "";
}

function StockPill({ stock }) {
  const value = Number(stock ?? 0);
  const safe = Number.isFinite(value) ? value : 0;

  if (safe <= 0) return <span className="stock-pill out">Stok 0</span>;

  const tone = safe <= 5 ? "low" : safe <= 20 ? "mid" : "ok";
  return <span className={`stock-pill ${tone}`}>{safe} slot</span>;
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
    const totalSold = variants.reduce((sum, variant) => sum + Number(variant?.sold_count || 0), 0);

    return {
      minPrice: prices.length ? Math.min(...prices) : 0,
      maxPrice: prices.length ? Math.max(...prices) : 0,
      totalStock,
      totalSold,
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
  const categoryLabel = useMemo(() => deriveCategoryLabel(product), [product]);
  const accessLabel = useMemo(() => deriveAccessLabel(product, variants), [product, variants]);
  const deliveryLabel = useMemo(() => deriveDeliveryLabel(product, variants), [product, variants]);
  const durationSummary = useMemo(() => deriveDurationSummary(variants), [variants]);
  const guaranteeSummary = useMemo(() => deriveGuaranteeSummary(variants), [variants]);
  const recommendedVariantId = useMemo(() => pickRecommendedVariant(variants), [variants]);

  const heroBadges = useMemo(
    () => [categoryLabel, accessLabel, deliveryLabel],
    [accessLabel, categoryLabel, deliveryLabel]
  );

  const productSummaryCopy = useMemo(
    () =>
      summarizeCopy(
        product?.description,
        "Pilih paket yang paling pas lalu lanjut checkout tanpa pindah alur."
      ),
    [product?.description]
  );

  const productNotes = useMemo(() => {
    const notes = uniqueNonEmpty([
      ...normalizeLines(product?.description).slice(1, 3),
      deliveryLabel === "Kirim via email" ? "Akses biasanya dikirim lewat email setelah pembayaran masuk." : "",
      accessLabel === "Diproses admin" ? "Paket diproses manual oleh admin sesuai antrean aktif." : "",
    ]);
    return notes.slice(0, 2).map((note) => (note.length > 88 ? `${note.slice(0, 85).trimEnd()}...` : note));
  }, [accessLabel, deliveryLabel, product?.description]);

  const glanceCards = useMemo(
    () => [
      {
        label: "Durasi",
        value: durationSummary,
        copy: `${variants.length} varian`,
      },
      {
        label: "Akses",
        value: accessLabel,
        copy: deliveryLabel,
      },
      {
        label: "Garansi",
        value: guaranteeSummary,
        copy: summary.totalStock > 0 ? `${summary.totalStock} slot ready` : "Restock",
      },
    ],
    [accessLabel, deliveryLabel, durationSummary, guaranteeSummary, summary.totalStock, variants.length]
  );

  const cartSnapshot = useMemo(() => {
    const related = cart.items.filter((item) => item.product_id === product?.id);
    return {
      itemCount: related.reduce((sum, item) => sum + Number(item.qty || 0), 0),
      subtotal: related.reduce(
        (sum, item) => sum + Number(item.price_idr || 0) * Number(item.qty || 0),
        0
      ),
    };
  }, [cart.items, product?.id]);

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
                      {heroBadges.map((badge) => (
                        <span key={badge} className="product-detail-metaPill">
                          {badge}
                        </span>
                      ))}
                    </div>

                    <h1 className="product-detail-title">{product.name}</h1>
                    <p className="product-detail-desc">{productSummaryCopy}</p>
                  </div>
                </div>

                <div className="product-detail-band">
                  <div className="product-detail-priceCard">
                    <div className="product-detail-priceLabel">Mulai dari</div>
                    <div className="product-detail-range">{formatPriceRange(summary.minPrice, summary.maxPrice)}</div>
                    <div className="product-detail-priceHint">
                      Harga varian aktif.
                    </div>
                  </div>

                  <div className="product-detail-glance">
                    {glanceCards.map((item) => (
                      <div key={item.label} className="product-detail-glanceCard">
                        <span className="product-detail-glanceLabel">{item.label}</span>
                        <strong className="product-detail-glanceValue">{item.value}</strong>
                        <span className="product-detail-glanceCopy">{item.copy}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {productNotes.length ? (
                  <div className="product-detail-notes">
                    {productNotes.map((note) => (
                      <div key={note} className="product-detail-note">
                        {note}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <aside className="product-detail-side">
                <div className="product-detail-sideCard">
                  <span className="product-detail-sideKicker">Checkout cepat</span>
                  <h2 className="product-detail-sideTitle">Pilih. Atur. Bayar.</h2>

                  <div className="product-detail-stepRail">
                    {CHECKOUT_STEPS.map((step) => (
                      <div key={step.label} className="product-detail-stepItem">
                        <strong>{step.label}</strong>
                        <span>{step.helper}</span>
                      </div>
                    ))}
                  </div>

                  <div className="product-detail-sideStats">
                    <div className="product-detail-sideStat">
                      <strong>{cartSnapshot.itemCount || variants.length}</strong>
                      <span>{cartSnapshot.itemCount > 0 ? "item di keranjang" : "varian aktif"}</span>
                    </div>
                    <div className="product-detail-sideStat">
                      <strong>
                        {cartSnapshot.itemCount > 0
                          ? formatIDR(cartSnapshot.subtotal)
                          : `${summary.totalStock}`}
                      </strong>
                      <span>{cartSnapshot.itemCount > 0 ? "subtotal produk" : "slot tersedia"}</span>
                    </div>
                  </div>

                  <div className="product-detail-sideActions">
                    <Link className="btn btn-sm product-detail-sideBtn" to="/checkout">
                      <ShoppingCart size={14} />
                      <span>{cartSnapshot.itemCount > 0 ? "Checkout" : "Keranjang"}</span>
                    </Link>
                    <Link className="btn btn-ghost btn-sm product-detail-sideBtnGhost" to="/status">
                      Cek status pesanan
                    </Link>
                  </div>
                </div>
              </aside>
            </div>

            <div className="product-detail-cartBar">
              <div className="product-detail-cartCopy">
                <Sparkles size={14} />
                <span>
                  {cartSnapshot.itemCount > 0
                    ? `${cartSnapshot.itemCount} item sudah di keranjang.`
                    : "Pilih paket. Checkout. Simpan ID."}
                </span>
              </div>

              <Link className="product-detail-cartAction" to="/checkout">
                Lihat checkout
                <ChevronRight size={15} />
              </Link>
            </div>

            <div className="divider" />

            <div className="variants-head">
              <div>
                <div className="variants-eyebrow">Varian aktif</div>
                <h2 className="h2">Pilih paket yang paling pas</h2>
                <p className="variants-copy">Ringkas di depan. Detail bila perlu.</p>
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
                const stockState = getStockState(stock);
                const isRecommended = variant.id === recommendedVariantId;
                const variantNotes = normalizeLines(variant.description);
                const previewNote =
                  (variantNotes[0] && (variantNotes[0].length > 82 ? `${variantNotes[0].slice(0, 79).trimEnd()}...` : variantNotes[0])) ||
                  (out
                    ? "Slot sedang habis. Cek lagi saat stok terbuka."
                    : "Varian siap diproses setelah pembayaran terverifikasi.");
                const extraNotes = variantNotes
                  .slice(1, 3)
                  .map((line) => (line.length > 92 ? `${line.slice(0, 89).trimEnd()}...` : line));
                const factChips = uniqueNonEmpty([
                  variant.duration_label,
                  deriveVariantMode(variant),
                  variant.guarantee_text || "Garansi admin",
                ]).slice(0, 3);

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

                        <span className={`variant-badge tone-${stockState.tone}`}>{stockState.label}</span>
                      </div>

                      <StockPill stock={variant.stock} />
                    </div>

                    <div className="variant-head">
                      <div>
                        <div className="variant-title">{variant.name}</div>
                        <div className="variant-facts">
                          {factChips.map((chip) => (
                            <span key={chip} className="variant-chip">
                              {chip}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="variant-priceWrap">
                        <div className="variant-priceLabel">Harga</div>
                        <div className="variant-price">{formatIDR(variant.price_idr)}</div>
                        <div className="variant-subPrice">per paket</div>
                      </div>
                    </div>

                    <div className="variant-summary">{previewNote}</div>

                    {extraNotes.length ? (
                      <details className="variant-notes">
                        <summary>Detail</summary>
                        <div className="variant-noteList">
                          {extraNotes.map((line) => (
                            <div key={line} className="variant-noteItem">
                              {line}
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : null}

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

          {variants.length > 0 ? (
            <div className="product-detail-mobileBar">
              <div className="product-detail-mobileBarCopy">
                <span>Mulai dari</span>
                <strong>{formatIDR(summary.minPrice || summary.maxPrice || 0)}</strong>
              </div>
              <Link className="btn btn-sm product-detail-mobileBtn" to="/checkout">
                {cartSnapshot.itemCount > 0 ? `Checkout (${cartSnapshot.itemCount})` : "Checkout"}
              </Link>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
