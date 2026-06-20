import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ChevronDown,
  Clock3,
  Flame,
  Info,
  Mail,
  Share2,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
} from "lucide-react";

import { fetchProductBySlug, fetchActiveFlashSales, fetchProducts } from "../lib/api";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { formatIDR } from "../lib/format";
import { usePageMeta } from "../hooks/usePageMeta";
import EmptyState from "../components/EmptyState";
import { useAdaptiveMotion } from "../hooks/useAdaptiveMotion";
import { fireConfetti } from "../components/Confetti";
import { spawnCartFlyParticle } from "../lib/cartFlyParticle";
import ProductTile from "../components/ProductTile";
import "../css/pages/ProductDetail.css";

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

function VariantBenefitList({ rawText }) {
  const [expanded, setExpanded] = useState(false);
  const sections = useMemo(() => parseDescriptionToSections(rawText), [rawText]);

  if (!sections.length) return null;

  return (
    <div className="pdx-benefitList">
      <button
        type="button"
        className={`pdx-benefitToggle-modern ${expanded ? "is-expanded" : ""}`}
        onClick={() => setExpanded((p) => !p)}
      >
        <span>Info paket</span>
        <ChevronDown size={15} className="pdx-benefitChevron" />
      </button>

      {expanded
        ? sections.map((section, si) => {
            const SectionIcon = section.icon ? SECTION_ICONS[section.icon] || Info : null;

            return (
              <div key={si} className={`pdx-benefitSection ${section.label ? "has-label" : ""}`}>
                {section.label ? (
                  <div className={`pdx-benefitSectionLabel icon-${section.icon || "default"}`}>
                    {SectionIcon ? <SectionIcon size={13} /> : null}
                    <span>{section.label}</span>
                  </div>
                ) : null}
                <ul className="pdx-benefitItems">
                  {section.items.map((item, ii) => (
                    <li key={ii} className="pdx-benefitItem">
                      <span className="pdx-benefitDot" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        : null}
    </div>
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
  if (min && max && min !== max) return `${formatIDR(min)} – ${formatIDR(max)}`;
  return formatIDR(min || max);
}

function classifyVariant(name) {
  const n = String(name || "").toLowerCase();
  if (n.match(/sharing|share/)) return "sharing";
  if (n.match(/private|privat|prem|pro|standart|ultimate|diamond/)) return "private";
  if (n.match(/fam|family|business/)) return "family";
  if (n.match(/pass|member|starlight/)) return "membership";
  if (n.match(/koin|coin|uc|cp|vp/)) return "topup";
  if (n.match(/promo|diskon|flash/)) return "promo";
  if (n.match(/akun|buyer|seller/)) return "akun";
  if (n.match(/lifetime|selamanya/)) return "lifetime";
  if (n.match(/bulan/)) return "bulanan";
  if (n.match(/tahun/)) return "tahunan";
  return "lainnya";
}

function getProductCategory(name) {
  const n = String(name || "").toLowerCase();
  if (n.match(/netflix|youtube|spotify|disney|prime|wetv|viu|iqiyi|hbo/)) return "streaming";
  if (n.match(/canva|chatgpt|capcut|midjourney|notion|office|zoom|github|copilot/)) return "productivity";
  return "other";
}

function ProductDescription({ text }) {
  return (
    <div className="pdx-descBlock is-expanded">
      <p className="pdx-lead">
        {text}
      </p>
    </div>
  );
}

function StockPill({ stock }) {
  const value = Number(stock ?? 0);
  const safe = Number.isFinite(value) ? value : 0;

  if (safe <= 0) return <span className="pdx-stockPill out">Habis</span>;

  const tone = safe <= 5 ? "low" : safe <= 20 ? "mid" : "ok";
  return <span className={`pdx-stockPill ${tone}`}>Stok {safe}</span>;
}

const VariantCard = React.memo(({
  variant,
  isSelected,
  isAdded,
  isRecommended,
  flashDiscount,
  effectivePrice,
  descriptionBody,
  isMotionOff,
  motionMode,
  onSelect,
  onAdd,
  onBuy
}) => {
  const stock = Number(variant.stock ?? 0);
  const out = stock <= 0;
  const disableEntranceAnim = isMotionOff || motionMode === "lite";

  const cardProps = {
    role: "button",
    tabIndex: 0,
    className: `pdx-packCard ${out ? "is-out" : ""} ${isRecommended ? "is-recommended" : ""} ${isSelected ? "is-selected" : ""} ${isAdded ? "is-added" : ""}`,
    onClick: () => onSelect(variant.id),
    onKeyDown: (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect(variant.id);
      }
    },
  };

  const cardChildren = (
    <>
      <div className="pdx-packHead">
        <div className="pdx-packInfo">
          {isRecommended ? (
            <span className="pdx-packHot">
              <Flame size={12} />
              Rameeee
            </span>
          ) : null}
          <h3 className="pdx-packName">{variant.name}</h3>
          <div className="pdx-packMeta">
            <StockPill stock={variant.stock} />
            {variant.duration_label ? (
              <span className="pdx-packMetaItem">
                <Clock3 size={12} />
                {variant.duration_label}
              </span>
            ) : null}
            {variant.requires_buyer_email ? (
              <span className="pdx-packMetaItem">
                <Mail size={12} />
                Butuh email
              </span>
            ) : null}
          </div>
        </div>

        <div className="pdx-packPriceWrap">
          {flashDiscount ? (
            <>
              <div className="pdx-packPrice pdx-variantPrice--flash">
                {formatIDR(effectivePrice)}
              </div>
              <div className="pdx-variantOriginalPrice">
                {formatIDR(variant.price_idr)}
              </div>
            </>
          ) : (
            <div className="pdx-packPrice">{formatIDR(variant.price_idr)}</div>
          )}
        </div>
      </div>

      <VariantBenefitList rawText={descriptionBody} />

      <div className="pdx-packActions">
        <button
          className={`btn btn-sm btn-ghost pdx-addBtn ${out ? "btn-disabled" : ""}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAdd(variant, 1, e);
          }}
          disabled={out}
          aria-label="Tambah ke keranjang"
        >
          <ShoppingCart size={14} />
          <span className="pdx-addBtnLabel">Keranjang</span>
        </button>
        <button
          className={`btn btn-sm pdx-buyNowBtn ${out ? "btn-disabled" : ""}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onBuy(variant, 1, e);
          }}
          disabled={out}
        >
          {out ? "Habis" : "Beli sekarang"}
        </button>
      </div>
    </>
  );

  // On mobile (lite/off motion mode), skip Framer Motion entirely to avoid its
  // internal JS overhead (ref tracking, animation scheduler) for every card.
  if (disableEntranceAnim) {
    return <article {...cardProps}>{cardChildren}</article>;
  }

  return (
    <motion.article
      {...cardProps}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {cardChildren}
    </motion.article>
  );
});


VariantCard.displayName = "VariantCard";

function ProductInfoTabs({ productDescriptionText, isMotionOff }) {
  const [activeInfoTab, setActiveInfoTab] = useState("description");
  // 0 = description tab (left), 1 = terms tab (right)
  const tabIndex = activeInfoTab === "description" ? 0 : 1;

  return (
    <div className="pdx-infoTabsCard">
      {/* Tab header with a pure-CSS sliding indicator (no Framer Motion layoutId).
          The indicator is a single element that translates via a CSS custom property,
          which composites on the GPU with zero layout work. */}
      <div className="pdx-infoTabsHeader">
        <button
          type="button"
          className={`pdx-infoTabBtn ${activeInfoTab === "description" ? "is-active" : ""}`}
          onClick={() => setActiveInfoTab("description")}
        >
          <span className="pdx-infoTabLabel">Deskripsi</span>
        </button>
        <button
          type="button"
          className={`pdx-infoTabBtn ${activeInfoTab === "terms" ? "is-active" : ""}`}
          onClick={() => setActiveInfoTab("terms")}
        >
          <span className="pdx-infoTabLabel">Syarat &amp; Ketentuan</span>
        </button>
      </div>
      <div className="pdx-infoTabContent">
        {activeInfoTab === "description" ? (
          <ProductDescription text={productDescriptionText} />
        ) : (
          <ol className="pdx-termsList">
            <li>
              <span className="pdx-termNum">1</span>
              <span className="pdx-termText">Transaksi hanya dianggap sah setelah pembayaran terverifikasi secara otomatis oleh sistem QRIS, dan pembeli wajib menyimpan ID Order (IMZ-XXXX) sebagai bukti pembelian.</span>
            </li>
            <li>
              <span className="pdx-termNum">2</span>
              <span className="pdx-termText">Pengiriman pesanan dilakukan secara manual ke WhatsApp terdaftar dengan waktu proses 5–30 menit (maksimal 2 jam untuk varian email) khusus pada jam operasional 08.00–22.00 WIB.</span>
            </li>
            <li>
              <span className="pdx-termNum">3</span>
              <span className="pdx-termText">Garansi replace (ganti akun) hanya berlaku jika akun mengalami kendala atau mati sebelum masa aktif durasi paket berakhir.</span>
            </li>
            <li>
              <span className="pdx-termNum">4</span>
              <span className="pdx-termText">Dilarang keras mengubah password, email, profil, PIN, atau data login lainnya pada akun bertipe sharing untuk menghindari hangusnya garansi.</span>
            </li>
            <li>
              <span className="pdx-termNum">5</span>
              <span className="pdx-termText">Segala aduan kendala wajib menyertakan ID Order valid agar dapat diproses lebih lanjut oleh admin WhatsApp.</span>
            </li>
          </ol>
        )}
      </div>
    </div>
  );
}

export default function ProductDetail() {
  const nav = useNavigate();
  const location = useLocation();
  const { slug } = useParams();
  const toast = useToast();
  const cart = useCart();
  const { add } = cart;
  // Native reduced motion check — no longer needs framer-motion
  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const motionMode = useAdaptiveMotion();

  const isMotionOff = motionMode === "off" || reduceMotion;

  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState(null);
  const [allProducts, setAllProducts] = useState([]);
  const [error, setError] = useState("");
  const [flashSaleMap, setFlashSaleMap] = useState(new Map());
  const [activeTab, setActiveTab] = useState("semua");
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [addedVariantId, setAddedVariantId] = useState(null);
  const addedFlashTimerRef = useRef(null);

  usePageMeta({
    title: product?.name ? `${product.name} | Detail Produk` : "Detail Produk",
    description: product?.description || "Pilih paket yang cocok, terus lanjut checkout.",
    ogImage: product?.icon_url || undefined,
  });

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError("");
        const [data, flashSales, productsData] = await Promise.all([
          fetchProductBySlug(slug),
          fetchActiveFlashSales().catch(() => []),
          fetchProducts().catch(() => []),
        ]);
        if (!alive) return;
        setProduct(data);
        setAllProducts(productsData || []);
        const fsMap = new Map();
        (flashSales || []).forEach((sale) => fsMap.set(sale.variant_id, sale.discount_percent));
        setFlashSaleMap(fsMap);
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
    const tabs = new Set(variants.map((v) => classifyVariant(v.name)));
    const tabArr = [{ id: "semua", label: "Semua" }];
    const order = [
      ["bulanan", "Bulanan"],
      ["tahunan", "Tahunan"],
      ["lifetime", "Lifetime"],
      ["sharing", "Sharing"],
      ["private", "Private"],
      ["family", "Family"],
      ["akun", "Akun"],
      ["membership", "Member"],
      ["topup", "Topup"],
      ["promo", "Promo"],
      ["lainnya", "Lainnya"],
    ];
    order.forEach(([id, label]) => {
      if (tabs.has(id)) tabArr.push({ id, label });
    });
    return tabArr;
  }, [variants]);

  const displayedVariants = useMemo(() => {
    if (activeTab === "semua") return variants;
    return variants.filter((v) => classifyVariant(v.name) === activeTab);
  }, [variants, activeTab]);

  const summary = useMemo(() => {
    const prices = variants
      .map((variant) => {
        const base = Number(variant?.price_idr || 0);
        const flashDiscount = flashSaleMap.get(variant.id);
        if (flashDiscount && flashDiscount > 0) {
          return Math.round(base * (1 - flashDiscount / 100));
        }
        return base;
      })
      .filter((value) => Number.isFinite(value) && value > 0);

    return {
      minPrice: prices.length ? Math.min(...prices) : 0,
      maxPrice: prices.length ? Math.max(...prices) : 0,
    };
  }, [variants, flashSaleMap]);

  const cartItemCount = useMemo(
    () => (cart?.items || []).reduce((sum, item) => sum + Number(item?.qty || 0), 0),
    [cart?.items]
  );

  const soldTotal = useMemo(
    () => variants.reduce((sum, variant) => sum + Math.max(0, Number(variant?.sold_count || 0)), 0),
    [variants]
  );

  const recommendedVariantId = useMemo(() => pickRecommendedVariant(variants), [variants]);

  useEffect(() => {
    if (!displayedVariants.length) {
      setSelectedVariantId(null);
      return;
    }
    const preferred =
      displayedVariants.find((variant) => variant.id === recommendedVariantId) || displayedVariants[0];
    setSelectedVariantId(preferred?.id ?? null);
  }, [activeTab, displayedVariants, recommendedVariantId]);

  useEffect(
    () => () => {
      if (addedFlashTimerRef.current) window.clearTimeout(addedFlashTimerRef.current);
    },
    []
  );

  const brandColor = useMemo(() => {
    const name = String(product?.name || "").toLowerCase();
    if (name.includes("netflix")) return "rgba(229, 9, 20, 0.45)";
    if (name.includes("canva")) return "rgba(0, 196, 204, 0.45)";
    if (name.includes("spotify")) return "rgba(29, 185, 84, 0.45)";
    if (name.includes("youtube")) return "rgba(255, 0, 0, 0.45)";
    if (name.includes("chatgpt")) return "rgba(16, 163, 127, 0.45)";
    if (name.includes("capcut")) return "rgba(0, 0, 0, 0.35)";
    if (name.includes("disney")) return "rgba(17, 60, 207, 0.45)";
    if (name.includes("prime")) return "rgba(0, 168, 225, 0.45)";
    return "rgba(255, 255, 255, 0.15)";
  }, [product?.name]);

  const recommendations = useMemo(() => {
    if (!product || !allProducts.length) return [];
    const currentCat = getProductCategory(product.name);
    
    return allProducts
      .filter((p) => p.id !== product.id)
      .map((p) => {
        let score = 0;
        const pCat = getProductCategory(p.name);
        
        // Category match
        if (pCat === currentCat && currentCat !== "other") {
          score += 10;
        }
        
        // Sub-variant count / stock factor (favor active products with stock)
        const variantsList = p.product_variants || [];
        const activeVariants = variantsList.filter((v) => v.is_active);
        const totalStock = activeVariants.reduce((sum, v) => sum + Number(v.stock || 0), 0);
        const totalSold = activeVariants.reduce((sum, v) => sum + Number(v.sold_count || 0), 0);
        
        if (totalStock > 0) score += 5;
        score += Math.min(5, totalSold * 0.01); // boost popular slightly
        
        return { product: p, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((item) => item.product);
  }, [product, allProducts]);

  const productDescriptionText = useMemo(
    () => product?.description || "Pilih paket, checkout, selesai.",
    [product?.description]
  );

  function handleAdd(variant, qty = 1, event) {
    const stock = Number(variant?.stock ?? 999);

    if (stock <= 0) {
      toast.error("Produk ini sedang habis", { title: variant.name, duration: 2500 });
      return;
    }

    const flashDiscount = flashSaleMap.get(variant.id);
    const effectivePrice =
      flashDiscount && flashDiscount > 0
        ? Math.round(variant.price_idr * (1 - flashDiscount / 100))
        : variant.price_idr;

    add(
      {
        ...variant,
        price_idr: effectivePrice,
        product_id: product.id,
        product_name: product.name,
        product_icon_url: product.icon_url || "",
      },
      qty
    );

    toast.success(`${variant.name} · ${formatIDR(effectivePrice)}`, {
      title: "Masuk keranjang",
      duration: 3200,
      actionLabel: "Lihat keranjang",
      onAction: () => nav("/checkout", { state: { backgroundLocation: location } }),
    });

    setSelectedVariantId(variant.id);
    setAddedVariantId(variant.id);
    if (addedFlashTimerRef.current) window.clearTimeout(addedFlashTimerRef.current);
    addedFlashTimerRef.current = window.setTimeout(() => setAddedVariantId(null), 600);

    if (event?.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect();
      const isMobile = window.matchMedia("(pointer: coarse), (max-width: 920px)").matches;
      if (!isMobile && !isMotionOff) {
        fireConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
        spawnCartFlyParticle(rect);
      }
      const btn = event.currentTarget;
      btn.classList.add("is-pressed");
      window.setTimeout(() => btn.classList.remove("is-pressed"), 180);
    }
  }

  async function handleShare() {
    if (!product) return;
    const shareUrl = window.location.href;
    const minPrice = summary.minPrice ? ` — mulai ${formatIDR(summary.minPrice)}` : "";
    const waText = encodeURIComponent(
      `Cek ${product.name} di Imzaqi Store${minPrice}\n${shareUrl}`
    );
    const waShareUrl = `https://wa.me/?text=${waText}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: product.name,
          text: `Beli ${product.name} di Imzaqi Store`,
          url: shareUrl,
        });
      } else {
        window.open(waShareUrl, "_blank", "noopener,noreferrer");
      }
    } catch (e) {
      if (e?.name !== "AbortError") {
        window.open(waShareUrl, "_blank", "noopener,noreferrer");
      }
    }
  }

  if (loading) {
    return (
      <div className="page detail-page detail-page-v3">
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
      <div className="page detail-page detail-page-v3">
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

  const icon = product.icon_url;

  return (
    <div className={`page detail-page detail-page-v3${cartItemCount > 0 ? " with-sticky-cta" : ""}`}>
      <section className="section">
        <div className="container">
          {/* On mobile, a plain div is used (no Framer Motion) to reduce JS overhead.
              The route-transition CSS class from Layout.jsx handles the page enter animation. */}
          <div className="pdx-layout">
            <div className="pdx-mainGrid">
              <div className="pdx-leftCol">
                <header className="pdx-topCard" style={{ "--brand-color": brandColor }}>
                  <div className="pdx-toolbar">
                    <Link to="/produk" className="pdx-backLink">
                      <ArrowLeft size={15} />
                      <span>Katalog</span>
                    </Link>

                    <div className="pdx-topActions">
                      <button type="button" className="pdx-iconBtn" onClick={handleShare} title="Bagikan">
                        <Share2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="pdx-heroMain">
                    <div 
                      className="catalog-cardIcon pdx-productIcon"
                      style={{ "--brand-color": brandColor }}
                    >
                      {icon ? (
                        <img src={icon} alt="" fetchPriority="high" decoding="async" />
                      ) : (
                        <span>{String(product.name || "P").slice(0, 1).toUpperCase()}</span>
                      )}
                    </div>

                    <div className="pdx-heroContent">
                      <h1 className="pdx-title">{product.name}</h1>
                    </div>
                  </div>

                  <div className="pdx-statsStrip">
                    <div className="pdx-heroPrice">
                      <span className="pdx-priceLabel">Mulai dari</span>
                      <strong className="pdx-priceValue">
                        {summary.minPrice ? formatIDR(summary.minPrice) : "-"}
                      </strong>
                    </div>
                    <div className="pdx-statsChips">
                      <span className="pdx-heroStat">
                        <ShoppingBag size={13} />
                        {soldTotal} terjual
                      </span>
                      <span className="pdx-heroStat">
                        <ShieldCheck size={13} />
                        Garansi
                      </span>
                    </div>
                  </div>
                </header>

                <ProductInfoTabs
                  productDescriptionText={productDescriptionText}
                  isMotionOff={isMotionOff}
                />
              </div>

              <div className="pdx-rightCol">
                <section id="paket-tersedia" className="pdx-variantsSection">
                  <div className="pdx-variantsHead">
                    <div className="pdx-variantsHeadTop">
                      <div className="pdx-eyebrow">Pilih paket</div>
                      <div className="pdx-countBadge">{displayedVariants.length} opsi</div>
                    </div>
                    <h2 className="pdx-sectionTitle">Pilih Paket Terbaikmu</h2>
                  </div>

                  {categoryTabs.length > 2 ? (
                    <div className="pdx-filters">
                      {categoryTabs.map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveTab(tab.id)}
                          className={`pdx-filterChip ${activeTab === tab.id ? "is-active" : ""}`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <div className="pdx-packList">
                    {displayedVariants.length === 0 ? (
                      <div className="pdx-emptyCard">
                        <EmptyState
                          icon="-"
                          title={variants.length === 0 ? "Belum ada paket" : "Tidak ada paket di kategori ini"}
                          description={
                            variants.length === 0
                              ? "Admin belum menambahkan varian untuk produk ini."
                              : "Coba pilih kategori lain atau lihat semua paket."
                          }
                          primaryAction={
                            variants.length > 0
                              ? { label: "Lihat semua", onClick: () => setActiveTab("semua") }
                              : { label: "Kembali ke katalog", onClick: () => nav("/produk") }
                          }
                        />
                      </div>
                    ) : (
                      displayedVariants.map((variant) => {
                        const stock = Number(variant.stock ?? 0);
                        const out = stock <= 0;
                        const isRecommended = variant.id === recommendedVariantId;
                        const flashDiscount = flashSaleMap.get(variant.id);
                        const effectivePrice =
                          flashDiscount && flashDiscount > 0
                            ? Math.round(variant.price_idr * (1 - flashDiscount / 100))
                            : variant.price_idr;
                        const descriptionBody = String(
                          variant.description ||
                            (out
                              ? "Slot sedang habis. Cek lagi saat stok terbuka."
                              : "Varian siap diproses setelah pembayaran terverifikasi.")
                        )
                          .replace(/\r\n/g, " ")
                          .trim();

                        return (
                          <VariantCard
                            key={variant.id}
                            variant={variant}
                            isSelected={selectedVariantId === variant.id}
                            isAdded={addedVariantId === variant.id}
                            isRecommended={isRecommended}
                            flashDiscount={flashDiscount}
                            effectivePrice={effectivePrice}
                            descriptionBody={descriptionBody}
                            isMotionOff={isMotionOff}
                            motionMode={motionMode}
                            onSelect={setSelectedVariantId}
                            onAdd={handleAdd}
                            onBuy={(v, q, e) => {
                              handleAdd(v, q, e);
                              nav("/checkout", { state: { backgroundLocation: location } });
                            }}
                          />
                        );
                      })
                    )}
                  </div>
                </section>
              </div>
            </div>

            {recommendations.length > 0 ? (
              <section className="pdx-recommendations">
                <div className="pdx-recommendationsHead">
                  <div className="pdx-eyebrow">Mungkin kamu butuh</div>
                  <h2 className="pdx-sectionTitle">Rekomendasi lainnya</h2>
                </div>
                <div className="product-grid-container grid-mode pdx-recommendationsGrid" role="list">
                  {recommendations.map((p) => (
                    <ProductTile key={p.id} product={p} layout="grid" disableTilt={true} />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </section>

      {cartItemCount > 0 ? (
        <div className="pdx-mobileStickyCart">
          <div className="pdx-stickyCartInner">
            <div className="pdx-stickyCartInfo">
              <ShoppingCart size={18} />
              <div className="pdx-stickyCartText">
                <span className="pdx-stickyQty">{cartItemCount} item</span>
                <span className="pdx-stickyLabel">di keranjang</span>
              </div>
            </div>
            <button
              className="btn pdx-stickyCheckoutBtn"
              type="button"
              onClick={() => nav("/checkout", { state: { backgroundLocation: location } })}
            >
              Checkout
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}