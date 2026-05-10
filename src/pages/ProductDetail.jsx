import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ChevronDown, ChevronUp, Clock3, Grid, Info, List, Mail, Minus, Plus, Share2, ShieldCheck, ShoppingBag, ShoppingCart, Sparkles } from "lucide-react";

import { fetchProductBySlug } from "../lib/api";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { formatIDR } from "../lib/format";
import { usePageMeta } from "../hooks/usePageMeta";
import EmptyState from "../components/EmptyState";
import { useAdaptiveMotion } from "../hooks/useAdaptiveMotion";

function normalizeInlineText(text) {
  return String(text || "")
    .replace(/\r?\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const EMOJI_PREFIX = /^[\s\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}\u{1F000}-\u{1FAFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]*/u;

const CATEGORY_KEYWORDS = [
  { pattern: /benefit\s*:/i, label: "Benefit", icon: "benefit" },
  { pattern: /detail\s*:/i, label: "Detail", icon: "detail" },
  { pattern: /garansi\s*:/i, label: "Garansi", icon: "garansi" },
  { pattern: /catatan\s*:/i, label: "Catatan", icon: "catatan" },
  { pattern: /note\s*:/i, label: "Catatan", icon: "catatan" },
  { pattern: /info\s*:/i, label: "Info", icon: "detail" },
];

function parseDescriptionToSections(rawText) {
  const text = String(rawText || "").replace(/\r\n/g, " ").trim();
  if (!text) return [];

  const tokens = text
    .split(/\s*-\s*/)
    .map((t) => t.trim())
    .filter(Boolean);

  if (tokens.length <= 1) {
    return [{ label: null, icon: null, items: [text] }];
  }

  const sections = [];
  let currentSection = { label: null, icon: null, items: [] };

  for (const token of tokens) {
    let matched = false;
    const cleanToken = token.replace(EMOJI_PREFIX, "");
    for (const kw of CATEGORY_KEYWORDS) {
      if (kw.pattern.test(cleanToken)) {
        if (currentSection.items.length > 0 || currentSection.label) {
          sections.push(currentSection);
        }
        const remainder = cleanToken.replace(kw.pattern, "").trim();
        currentSection = { label: kw.label, icon: kw.icon, items: [] };
        if (remainder) currentSection.items.push(remainder);
        matched = true;
        break;
      }
    }
    if (!matched) {
      currentSection.items.push(token);
    }
  }

  if (currentSection.items.length > 0 || currentSection.label) {
    sections.push(currentSection);
  }

  return sections;
}

const SECTION_ICONS = {
  benefit: Sparkles,
  detail: Info,
  garansi: ShieldCheck,
  catatan: Info,
};

const INITIAL_VISIBLE = 3;

function VariantBenefitList({ rawText }) {
  const [expanded, setExpanded] = useState(false);
  const sections = useMemo(() => parseDescriptionToSections(rawText), [rawText]);

  if (!sections.length) return null;

  const totalItems = sections.reduce((sum, s) => sum + s.items.length, 0);
  const canCollapse = totalItems > INITIAL_VISIBLE;

  let itemCount = 0;

  return (
    <div className="pdx-benefitList">
      {sections.map((section, si) => {
        const SectionIcon = section.icon ? SECTION_ICONS[section.icon] || Info : null;

        return (
          <div key={si} className={`pdx-benefitSection ${section.label ? "has-label" : ""}`}>
            {section.label && (
              <div className={`pdx-benefitSectionLabel icon-${section.icon || "default"}`}>
                {SectionIcon && <SectionIcon size={13} />}
                <span>{section.label}</span>
              </div>
            )}
            <ul className="pdx-benefitItems">
              {section.items.map((item, ii) => {
                itemCount++;
                const hidden = canCollapse && !expanded && itemCount > INITIAL_VISIBLE;
                return (
                  <li key={ii} className={`pdx-benefitItem ${hidden ? "is-hidden" : ""}`}>
                    <span className="pdx-benefitDot" />
                    <span>{item}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      {canCollapse && (
        <button
          type="button"
          className="pdx-benefitToggle"
          onClick={() => setExpanded((p) => !p)}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          <span>{expanded ? "Sembunyikan" : `Lihat semua (${totalItems})`}</span>
        </button>
      )}
    </div>
  );
}

const DESC_TRUNCATE_LENGTH = 120;

function ExpandableProductDesc({ text }) {
  const [expanded, setExpanded] = useState(false);
  const needsTruncate = text.length > DESC_TRUNCATE_LENGTH;
  const displayed = !needsTruncate || expanded ? text : text.slice(0, DESC_TRUNCATE_LENGTH).replace(/\s+\S*$/, "") + "…";

  return (
    <div className="pdx-descWrap">
      <p className="pdx-descriptionText">{displayed}</p>
      {needsTruncate && (
        <button
          type="button"
          className="pdx-descToggle"
          onClick={() => setExpanded((p) => !p)}
        >
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          <span>{expanded ? "Lebih sedikit" : "Selengkapnya"}</span>
        </button>
      )}
    </div>
  );
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

  if (safe <= 0) return <span className="pdx-stockPill out">Stok habis</span>;

  const tone = safe <= 5 ? "low" : safe <= 20 ? "mid" : "ok";
  return <span className={`pdx-stockPill ${tone}`}>Stok {safe}</span>;
}

export default function ProductDetail() {
  const nav = useNavigate();
  const location = useLocation();
  const { slug } = useParams();
  const toast = useToast();
  const cart = useCart();
  const { add } = cart;
  const reduceMotion = useReducedMotion();
  const motionMode = useAdaptiveMotion();

  const isMotionOff = motionMode === "off" || reduceMotion;
  const isLiteMotion = motionMode === "lite" && !isMotionOff;

  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState(null);
  const [error, setError] = useState("");
  const [qtyById, setQtyById] = useState({});
  const [activeTab, setActiveTab] = useState("semua");
  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem("pdx_viewMode") || "grid";
    } catch {
      return "grid";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("pdx_viewMode", viewMode);
    } catch {}
  }, [viewMode]);
  const [expandedVariantId, setExpandedVariantId] = useState(null);

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

  const categoryTabs = useMemo(() => {
    const tabs = new Set();
    variants.forEach(v => {
      const n = String(v.name || "").toLowerCase();
      if (n.match(/sharing|share/)) tabs.add("sharing");
      else if (n.match(/private|privat|prem|pro|standart|ultimate|diamond/)) tabs.add("private");
      else if (n.match(/fam|family|business/)) tabs.add("family");
      else if (n.match(/akun|buyer|seller/)) tabs.add("akun");
      else if (n.match(/pass|member|starlight/)) tabs.add("membership");
      else if (n.match(/koin|coin|uc|cp|vp/)) tabs.add("topup");
      else if (n.match(/promo|diskon|flash/)) tabs.add("promo");
      else tabs.add("lainnya");
    });
    
    const tabArr = [{ id: "semua", label: "Semua Paket" }];
    if (tabs.has("sharing")) tabArr.push({ id: "sharing", label: "Sharing" });
    if (tabs.has("private")) tabArr.push({ id: "private", label: "Private" });
    if (tabs.has("family")) tabArr.push({ id: "family", label: "Family / Biz" });
    if (tabs.has("akun")) tabArr.push({ id: "akun", label: "Akun" });
    if (tabs.has("membership")) tabArr.push({ id: "membership", label: "Membership" });
    if (tabs.has("topup")) tabArr.push({ id: "topup", label: "Topup" });
    if (tabs.has("promo")) tabArr.push({ id: "promo", label: "Promo" });
    if (tabs.has("lainnya")) tabArr.push({ id: "lainnya", label: "Lainnya" });
    return tabArr;
  }, [variants]);

  const displayedVariants = useMemo(() => {
    if (activeTab === "semua") return variants;
    return variants.filter(v => {
      const n = String(v.name || "").toLowerCase();
      const isSharing = n.match(/sharing|share/);
      const isPrivate = n.match(/private|privat|prem|pro|standart|ultimate|diamond/);
      const isFamily = n.match(/fam|family|business/);
      const isAkun = n.match(/akun|buyer|seller/);
      const isMembership = n.match(/pass|member|starlight/);
      const isTopup = n.match(/koin|coin|uc|cp|vp/);
      const isPromo = n.match(/promo|diskon|flash/);
      
      if (activeTab === "sharing") return isSharing;
      if (activeTab === "private") return isPrivate;
      if (activeTab === "family") return isFamily;
      if (activeTab === "akun") return isAkun;
      if (activeTab === "membership") return isMembership;
      if (activeTab === "topup") return isTopup;
      if (activeTab === "promo") return isPromo;
      if (activeTab === "lainnya") return !isSharing && !isPrivate && !isFamily && !isAkun && !isMembership && !isTopup && !isPromo;
      return true;
    });
  }, [variants, activeTab]);

  const summary = useMemo(() => {
    const prices = variants
      .map((variant) => Number(variant?.price_idr || 0))
      .filter((value) => Number.isFinite(value) && value > 0);

    return {
      minPrice: prices.length ? Math.min(...prices) : 0,
      maxPrice: prices.length ? Math.max(...prices) : 0,
    };
  }, [variants]);
  const cartItemCount = useMemo(
    () => (cart?.items || []).reduce((sum, item) => sum + Number(item?.qty || 0), 0),
    [cart?.items]
  );
  const soldTotal = useMemo(
    () => variants.reduce((sum, variant) => sum + Math.max(0, Number(variant?.sold_count || 0)), 0),
    [variants]
  );

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
  function scrollToVariants() {
    if (typeof document === "undefined") return;
    const target = document.getElementById("paket-tersedia");
    if (!target) return;
    target.scrollIntoView({
      behavior: isMotionOff || isLiteMotion ? "auto" : "smooth",
      block: "start",
    });
  }

  async function handleShare() {
    if (!product) return;
    const shareUrl = window.location.href;
    const shareData = {
      title: product.name,
      text: `Beli ${product.name} di Imzaqi Store`,
      url: shareUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Tautan produk berhasil disalin", { duration: 2000 });
      }
    } catch (e) {
      console.warn("Share failed", e);
    }
  }

  const icon = product?.icon_url;
  const durationSummary = useMemo(() => deriveDurationSummary(variants), [variants]);
  const guaranteeSummary = useMemo(() => deriveGuaranteeSummary(variants), [variants]);
  const recommendedVariantId = useMemo(() => pickRecommendedVariant(variants), [variants]);
  const productDescriptionText = useMemo(
    () => normalizeInlineText(product?.description) || "Pilih paket yang cocok lalu lanjut checkout.",
    [product?.description]
  );

  const heroBadges = useMemo(
    () => [
      { key: "duration", icon: Clock3, text: durationSummary || "-", color: "chip-duration" },
      { key: "guarantee", icon: ShieldCheck, text: guaranteeSummary || "Garansi admin", color: "chip-guarantee" },
      { key: "sold", icon: ShoppingBag, text: `${soldTotal} total terjual`, color: "chip-sold" },
    ],
    [durationSummary, guaranteeSummary, soldTotal]
  );

  if (loading) {
    return (
      <div className="page detail-page">
        <section className="section">
          <div className="container">
            <div className="pdx-loading">
              <div className="pdx-loadingLine w-34" />
              <div className="pdx-loadingLine w-62" />
              <div className="pdx-loadingGrid">
                <div className="pdx-loadingBlock" />
                <div className="pdx-loadingBlock" />
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="page detail-page">
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
    <div className="page detail-page detail-page-v2">
      <section className="section">
        <div className="container">
          <Link to="/produk" className="detail-backLink">
            <ArrowLeft size={16} />
            <span>Kembali ke katalog</span>
          </Link>

          <motion.div
            className="pdx-layout"
            initial={isMotionOff || isLiteMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              isMotionOff || isLiteMotion
                ? { duration: 0 }
                : { duration: 0.34, ease: [0.22, 1, 0.36, 1] }
            }
          >
            <section className="pdx-heroGrid">
              <article className="pdx-heroPanel">
                <div className="pdx-productBrand">
                  <div className="pdx-productIcon">
                    {icon ? <img src={icon} alt={`${product.name} icon`} fetchpriority="high" decoding="async" /> : (
                      <div className="pdx-productIconFallback">{String(product.name || "P").slice(0, 1).toUpperCase()}</div>
                    )}
                  </div>

                  <div className="pdx-productCopy">
                    <div className="pdx-metaRow">
                      {heroBadges.map((badge) => {
                        const Icon = badge.icon;
                        return (
                          <span key={badge.key} className={`pdx-metaPill ${badge.color}`}>
                            <Icon size={13} />
                            <span>{badge.text}</span>
                          </span>
                        );
                      })}
                    </div>

                    <h1 className="pdx-title">{product.name}</h1>
                    <ExpandableProductDesc text={productDescriptionText} />
                  </div>
                </div>
              </article>

              <aside className="pdx-summaryPanel">
                <div className="pdx-priceBlock">
                  <div className="pdx-priceLabel">Mulai dari</div>
                  <div className="pdx-priceValue">{formatPriceRange(summary.minPrice, summary.maxPrice)}</div>
                </div>

                <div className="pdx-summaryActions">
                  <div className="pdx-summaryActionsMain">
                    <button type="button" className="btn pdx-scrollBtn" onClick={scrollToVariants}>
                      <Sparkles size={15} />
                      <span>Lihat paket terbaik</span>
                    </button>
                    <button type="button" className="btn btn-ghost pdx-shareBtn" onClick={handleShare} title="Bagikan produk">
                      <Share2 size={15} />
                    </button>
                  </div>
                  <Link to="/checkout" state={{ backgroundLocation: location }} className="btn btn-ghost pdx-cartBtn">
                    <ShoppingCart size={15} />
                    <span>{cartItemCount > 0 ? `Buka keranjang (${cartItemCount})` : "Buka keranjang"}</span>
                  </Link>
                </div>
              </aside>
            </section>

            <section id="paket-tersedia" className="pdx-variantsSection">
              <div className="pdx-variantsHead">
                <div>
                  <div className="pdx-eyebrow">Pilihan Paket</div>
                  <h2 className="h2">Sesuaikan dengan kebutuhanmu</h2>
                </div>
                <div className="pdx-countBadge">{displayedVariants.length} paket tersedia</div>
              </div>

              <div className="pdx-toolbar">
                {categoryTabs.length > 2 && (
                  <div className="pdx-segmentControl">
                    {categoryTabs.map(tab => (
                      <button 
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`pdx-segmentBtn ${activeTab === tab.id ? "active" : ""}`}
                      >
                        {activeTab === tab.id && (
                          <motion.div 
                            layoutId="pdx-seg-pill" 
                            className="pdx-segmentPill"
                            transition={{ type: "spring", stiffness: 500, damping: 35 }}
                          />
                        )}
                        <span>{tab.label}</span>
                      </button>
                    ))}
                  </div>
                )}
                
                <div className="pdx-viewToggle">
                  <button 
                    type="button" 
                    className={`pdx-viewBtn ${viewMode === 'grid' ? 'active' : ''}`}
                    onClick={() => setViewMode('grid')}
                    title="Tampilan Kartu"
                  >
                    <Grid size={16} />
                  </button>
                  <button 
                    type="button" 
                    className={`pdx-viewBtn ${viewMode === 'list' ? 'active' : ''}`}
                    onClick={() => setViewMode('list')}
                    title="Tampilan Padat"
                  >
                    <List size={16} />
                  </button>
                </div>
              </div>

              <div className={`pdx-variantsGrid ${viewMode === 'list' ? 'is-list' : ''}`}>
              {(() => {
                return displayedVariants.map((variant) => {
                  const stock = Number(variant.stock ?? 0);
                  const out = stock <= 0;
                  const qty = getQty(variant);
                const maxQty = getMaxQty(variant);
                const canDec = qty > 1;
                const canInc = qty < maxQty;
                const isRecommended = variant.id === recommendedVariantId;
                const soldCount = Math.max(0, Number(variant?.sold_count || 0));
                const descriptionBody = String(
                  variant.description ||
                    (out
                      ? "Slot sedang habis. Cek lagi saat stok terbuka."
                      : "Varian siap diproses setelah pembayaran terverifikasi.")
                )
                  .replace(/\r\n/g, " ")
                  .trim();
                const factChips = [
                  { key: `duration-${variant.id}`, icon: Clock3, text: variant.duration_label || "-", color: "chip-duration" },
                  { key: `guarantee-${variant.id}`, icon: ShieldCheck, text: variant.guarantee_text || "Garansi admin", color: "chip-guarantee" },
                  { key: `sold-${variant.id}`, icon: ShoppingBag, text: `${soldCount} terjual`, color: "chip-sold" },
                ];
                if (variant.requires_buyer_email) {
                  factChips.push({ key: `email-${variant.id}`, icon: Mail, text: "Butuh Email", color: "chip-email" });
                }

                const isExpanded = expandedVariantId === variant.id;

                return (
                  <article
                    key={variant.id}
                    className={`pdx-variantCard ${out ? "is-out" : ""} ${isRecommended ? "is-recommended" : ""} ${isExpanded ? "is-expanded" : ""}`}
                  >
                    <div className="pdx-variantTop">
                      <div className="pdx-variantBadges">
                        {isRecommended ? (
                          <span className="pdx-variantBadge recommend">
                            <Sparkles size={12} />
                            <span>Rekomendasi</span>
                          </span>
                        ) : null}
                      </div>

                      <StockPill stock={variant.stock} />
                    </div>

                    <div className="pdx-variantHead">
                      <div>
                        <div className="pdx-variantTitle">{variant.name}</div>
                        <div className="pdx-variantFacts">
                          {factChips.map((chip) => {
                            const Icon = chip.icon;
                            return (
                              <span key={chip.key} className={`pdx-chip ${chip.color}`}>
                                <Icon size={12} />
                                <span>{chip.text}</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      <div className="pdx-variantPriceWrap">
                        <div className="pdx-variantPriceLabel">Harga</div>
                        <div className="pdx-variantPrice">{formatIDR(variant.price_idr)}</div>
                        <div className="pdx-variantSubPrice">per paket</div>
                      </div>
                    </div>

                    <div className={`pdx-variantNotes ${isExpanded ? 'force-show' : ''}`}>
                      <div className="pdx-variantNotesTitle">Benefit paket</div>
                      <VariantBenefitList
                        rawText={descriptionBody || "Informasi paket akan dikirim oleh admin setelah checkout."}
                      />
                    </div>

                    <div className="pdx-variantFoot">
                      {viewMode === 'list' && (
                        <button 
                          type="button" 
                          className={`btn btn-ghost btn-sm pdx-infoBtn ${isExpanded ? 'active' : ''}`} 
                          onClick={() => setExpandedVariantId(isExpanded ? null : variant.id)}
                          title="Lihat Deskripsi"
                        >
                          <Info size={16} />
                        </button>
                      )}
                      
                      <div className="pdx-qty" aria-label={`Jumlah untuk ${variant.name}`}>
                        <button
                          type="button"
                          className="pdx-qtyBtn"
                          onClick={() => setQty(variant, qty - 1)}
                          disabled={out || !canDec}
                          aria-label="Kurangi jumlah"
                        >
                          <Minus size={14} />
                        </button>

                        <div className="pdx-qtyNum" aria-label="Jumlah">
                          {qty}
                        </div>

                        <button
                          type="button"
                          className="pdx-qtyBtn"
                          onClick={() => setQty(variant, qty + 1)}
                          disabled={out || !canInc}
                          aria-label="Tambah jumlah"
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      <div className="pdx-actionBtns">
                        <button
                          className={`btn btn-sm btn-ghost pdx-addBtn ${out ? "btn-disabled" : ""}`}
                          type="button"
                          onClick={() => handleAdd(variant, qty)}
                          disabled={out}
                          title="Tambah ke keranjang"
                        >
                          <ShoppingCart size={14} />
                        </button>
                        <button
                          className={`btn btn-sm pdx-buyNowBtn ${out ? "btn-disabled" : ""}`}
                          type="button"
                          onClick={() => { handleAdd(variant, qty); nav("/checkout", { state: { backgroundLocation: location } }); }}
                          disabled={out}
                        >
                          <span>{out ? "Habis" : "Beli Langsung"}</span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              });
            })()}

              {variants.length === 0 ? (
                <div className="card pad">
                    description="Admin belum menambahkan varian untuk produk ini."
                  />
                </div>
              ) : null}
              </div>
            </section>
          </motion.div>
        </div>
      </section>

      {cartItemCount > 0 && (
        <div className="pdx-mobileStickyCart">
          <div className="pdx-stickyCartInner">
            <div className="pdx-stickyCartInfo">
              <ShoppingCart size={18} />
              <div className="pdx-stickyCartText">
                <span className="pdx-stickyQty">{cartItemCount} item</span>
                <span className="pdx-stickyLabel">di keranjang</span>
              </div>
            </div>
            <button className="btn pdx-stickyCheckoutBtn" onClick={() => nav("/checkout", { state: { backgroundLocation: location } })}>
              Ke Pembayaran
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
