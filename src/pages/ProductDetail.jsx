import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import "../css/pages/ProductDetail.css";
import {
  ArrowDown,
  ArrowLeft,
  ChevronDown,
  Clock3,
  Flame,
  Info,
  LayoutGrid,
  MessageCircle,
  Share2,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";

import { fetchProductBySlug, fetchActiveFlashSales, fetchProducts, fetchTopSellingData } from "../lib/api";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { asVariantList, formatGuaranteeLabel, formatIDR, getCatalogPriceRange, normalizeProductRecord, packDisplayName } from "../lib/format";
import { usePageMeta } from "../hooks/usePageMeta";
import EmptyState from "../components/EmptyState";
import { useAdaptiveMotion } from "../hooks/useAdaptiveMotion";
import { useDeviceCapability } from "../hooks/useIsMobile";
import VariantCompareModal from "../components/VariantCompareModal";
import { useLongTaskMonitor } from "../hooks/usePerformanceMonitor";
import { warn } from "../lib/log";
import { fireConfetti } from "../components/Confetti";

// ── Live viewer & countdown removed (fake data - hurts trust) ──────────────
import { spawnCartFlyParticle } from "../lib/cartFlyParticle";
import { getCatalogReturnPath, hasSavedScrollY } from "../hooks/useScrollMemory";
import { buildCatalogAdminWhatsAppUrl, resolveCatalogLine, resolveProductCategory } from "../lib/productCategories";
import ProductTile from "../components/ProductTile";
import AccountTypeStrip from "../components/AccountTypeStrip";
import RecentlyViewed from "../components/RecentlyViewed";
import { addRecentlyViewed } from "../lib/recentlyViewed";

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

function VariantBenefitList({ rawText, variant }) {
  const [expanded, setExpanded] = useState(false);
  const sections = useMemo(() => parseDescriptionToSections(rawText), [rawText]);
  const previewItems = useMemo(() => {
    const items = [];
    sections.forEach((section) => {
      (section.items || []).forEach((item) => {
        if (items.length < 3) items.push(item);
      });
    });
    return items;
  }, [sections]);
  const extraItemCount = Math.max(
    0,
    sections.reduce((sum, section) => sum + (section.items?.length || 0), 0) - previewItems.length
  );

  const infoRows = useMemo(() => {
    const rows = [];
    if (typeof variant?.sold_count === "number" && variant.sold_count > 0) {
      rows.push({ icon: ShoppingBag, label: "Terjual", value: `${variant.sold_count}×` });
    }
    return rows;
  }, [variant]);

  const hasExtra = extraItemCount > 0;
  if (!previewItems.length && !hasExtra) return null;

  if (previewItems.length === 1 && !hasExtra) {
    return <p className="pdx-packBlurb">{previewItems[0]}</p>;
  }

  return (
    <div className="pdx-benefitList">
      {previewItems.length ? (
        <ul className="pdx-benefitItems pdx-benefitItems--preview">
          {previewItems.map((item, index) => (
            <li key={`${item}-${index}`} className="pdx-benefitItem">
              <span className="pdx-benefitDot" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {hasExtra ? (
        <>
          <button
            type="button"
            className={`pdx-benefitToggle-modern ${expanded ? "is-expanded" : ""}`}
            onClick={(event) => {
              event.stopPropagation();
              setExpanded((current) => !current);
            }}
          >
            <span>{expanded ? "Sembunyikan" : `+${extraItemCount} lagi`}</span>
            <ChevronDown size={14} className="pdx-benefitChevron" />
          </button>

          {expanded ? (
            <>
              {infoRows.length > 0 ? (
                <div className="pdx-infoRows">
                  {infoRows.map(({ icon: Icon, label, value }) => (
                    <div key={label} className="pdx-infoRow">
                      <span className="pdx-infoRow-icon"><Icon size={13} /></span>
                      <span className="pdx-infoRow-label">{label}</span>
                      <span className="pdx-infoRow-value">{value}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              {sections.map((section, si) => {
                const SectionIcon = section.icon ? SECTION_ICONS[section.icon] || Info : null;
                const remaining = (section.items || []).filter((item) => !previewItems.includes(item));
                if (remaining.length === 0) return null;
                return (
                  <div key={si} className={`pdx-benefitSection ${section.label ? "has-label" : ""}`}>
                    {section.label ? (
                      <div className={`pdx-benefitSectionLabel icon-${section.icon || "default"}`}>
                        {SectionIcon ? <SectionIcon size={13} /> : null}
                        <span>{section.label}</span>
                      </div>
                    ) : null}
                    {remaining.length ? (
                      <ul className="pdx-benefitItems">
                        {remaining.map((item, ii) => (
                          <li key={ii} className="pdx-benefitItem">
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function parseDays(label) {
  const match = String(label || "").match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function pickRecommendedVariant(variants, flashSaleMap) {
  const source = variants.filter((variant) => Number(variant?.stock || 0) > 0);
  const target = source.length ? source : variants;
  if (!target.length) return null;

  return target
    .slice()
    .sort((a, b) => {
      const priceDiff = getVariantEffectivePrice(a, flashSaleMap) - getVariantEffectivePrice(b, flashSaleMap);
      if (priceDiff !== 0) return priceDiff;

      const dayDiff = parseDays(b?.duration_label) - parseDays(a?.duration_label);
      if (dayDiff !== 0) return dayDiff;

      return Number(b?.stock || 0) - Number(a?.stock || 0);
    })[0]?.id;
}

function pickTopSellerVariant(variants) {
  const source = variants.filter((variant) => Number(variant?.stock || 0) > 0);
  const target = source.length ? source : variants;
  if (!target.length) return null;
  const ranked = target
    .slice()
    .sort((a, b) => Number(b?.sold_count || 0) - Number(a?.sold_count || 0));
  if (Number(ranked[0]?.sold_count || 0) <= 0) return null;
  return ranked[0]?.id;
}

const VARIANT_SORTS = [
  { id: "reco", label: "Rekomendasi", icon: Sparkles },
  { id: "price_asc", label: "Termurah", icon: ArrowDown },
  { id: "popular", label: "Terlaris", icon: Flame },
];

const VARIANT_TAB_META = {
  semua: { label: "Semua", icon: LayoutGrid },
  bulanan: { label: "Bulanan", icon: Clock3 },
  tahunan: { label: "Tahunan", icon: Clock3 },
  lifetime: { label: "Lifetime", icon: Sparkles },
  sharing: { label: "Sharing", icon: Users },
  private: { label: "Private", icon: UserRound },
  family: { label: "Family", icon: Users },
  membership: { label: "Member", icon: ShoppingBag },
  topup: { label: "Topup", icon: ShoppingBag },
};

function getVariantEffectivePrice(variant, flashSaleMap) {
  const base = Number(variant?.price_idr);
  const price = Number.isFinite(base) ? base : Number.POSITIVE_INFINITY;
  const discount = Number(flashSaleMap?.get?.(variant?.id) || 0);
  if (discount > 0 && Number.isFinite(price) && price !== Number.POSITIVE_INFINITY) {
    return Math.round(price * (1 - discount / 100));
  }
  return price;
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

function ProductDescription({ text }) {
  return (
    <div className="pdx-descBlock is-expanded">
      <p className="pdx-lead">
        {text}
      </p>
    </div>
  );
}

function LazyProductImage({ src, alt, className, fetchPriority }) {
  const [loaded, setLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    if (!imgRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={imgRef} className={className} style={{ position: "relative" }}>
      {isInView ? (
        <img
          src={src}
          alt={alt}
          fetchPriority={fetchPriority}
          decoding="async"
          loading="lazy"
          onLoad={() => setLoaded(true)}
          style={{ opacity: loaded ? 1 : 0, transition: "opacity 0.2s" }}
        />
      ) : null}
      {!loaded && isInView ? (
        <div className="pdx-imgPlaceholder" style={{ position: "absolute", inset: 0 }} />
      ) : null}

    </div>
  );
}

const VariantCard = React.memo(({
  variant,
  siblingVariants,
  isSelected,
  isAdded,
  isRecommended,
  isTopSeller,
  flashDiscount,
  effectivePrice,
  descriptionBody,
  isMotionOff,
  motionMode,
  maxVariantStock,
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
    className: [
      "pdx-packCard",
      out ? "is-out" : "",
      isSelected ? "is-selected" : "",
      isRecommended ? "is-recommended" : "",
    ]
      .filter(Boolean)
      .join(" "),
    onClick: () => {
      if (out) return;
      onSelect(variant.id);
    },
    onKeyDown: (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (!out) onSelect(variant.id);
      }
    },
  };

  const guaranteeLabel = formatGuaranteeLabel(variant.guarantee_text);
  const durationLabel = String(variant.duration_label || "").replace(/^durasi\s+/i, "").trim();
  const factItems = [
    out ? "Habis" : `Stok ${stock}`,
    durationLabel || null,
    guaranteeLabel || null,
    variant.requires_buyer_email ? "Perlu email" : null,
  ].filter(Boolean);

  const cardChildren = (
    <>
      <div className="pdx-packHead">
        <div className="pdx-packTitleRow">
          <div className="pdx-packInfo">
            {isTopSeller ? (
              <span className="pdx-packHot">
                <Flame size={12} />
                Paling Laris
              </span>
            ) : isRecommended ? (
              <span className="pdx-packHot pdx-packHot--value">Paling hemat</span>
            ) : null}
            <h3 className="pdx-packName">{packDisplayName(variant, siblingVariants)}</h3>
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

        {factItems.length ? (
          <p className="pdx-packFacts">
            {factItems.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </p>
        ) : null}
      </div>

      <VariantBenefitList
        rawText={descriptionBody}
        variant={variant}
      />

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
          {out ? "Abis" : "Beli sekarang"}
        </button>
      </div>
    </>
  );

  return <article {...cardProps}>{cardChildren}</article>;
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

function ProductDetailSkeleton() {
  return (
    <div className="page detail-page detail-page-v3" aria-busy="true" aria-live="polite" aria-label="Memuat detail produk">
      <section className="section">
        <div className="container">
          <div className="pdx-layout">
            <div className="pdx-mainGrid pdx-skeletonGrid">
              <div className="pdx-leftCol">
                <div className="pdx-skeletonBillboard">
                  <div className="pdx-skel pdx-skeletonIcon" />
                  <div className="pdx-skeletonCopy">
                    <div className="pdx-skel pdx-skelLine w-24" />
                    <div className="pdx-skel pdx-skelLine w-70" />
                    <div className="pdx-skel pdx-skelLine w-44" />
                    <div className="pdx-skel pdx-skelLine w-36" />
                  </div>
                </div>
                <div className="pdx-skeletonTabs">
                  <div className="pdx-skel pdx-skelChip" />
                  <div className="pdx-skel pdx-skelChip" />
                </div>
                <div className="pdx-skel pdx-skelBlock" />
              </div>
              <div className="pdx-rightCol">
                <div className="pdx-skel pdx-skelLine w-28" />
                <div className="pdx-skeletonChips">
                  <div className="pdx-skel pdx-skelChip" />
                  <div className="pdx-skel pdx-skelChip" />
                  <div className="pdx-skel pdx-skelChip" />
                </div>
                <div className="pdx-skel pdx-skelPack" />
                <div className="pdx-skel pdx-skelPack" />
                <div className="pdx-skel pdx-skelPack" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function ProductDetail() {
  const nav = useNavigate();
  const location = useLocation();
  const catalogBackTo = getCatalogReturnPath();
  const goBackToCatalog = useCallback(() => {
    const cameFromCatalog = Boolean(location.state?.fromCatalog) || hasSavedScrollY();
    if (cameFromCatalog && window.history.length > 1) {
      nav(-1);
      return;
    }
    nav(catalogBackTo);
  }, [catalogBackTo, location.state, nav]);
  const { slug } = useParams();
  const toast = useToast();
  const cart = useCart();
  const { add } = cart;
  const caps = useDeviceCapability();

  const goCheckout = useCallback(() => {
    nav("/checkout", { state: { backgroundLocation: location } });
  }, [nav, location]);

  useLongTaskMonitor();

  const reduceMotion = caps.isReducedMotion;
  const motionMode = useAdaptiveMotion();

  const isMotionOff = motionMode === "off" || reduceMotion;

  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState(null);
  const [allProducts, setAllProducts] = useState([]);
  const [recommendationsReady, setRecommendationsReady] = useState(false);
  const recommendationsRef = useRef(null);
  const [error, setError] = useState("");
  const [flashSaleMap, setFlashSaleMap] = useState(new Map());
  const [topSalesMap, setTopSalesMap] = useState({});
  const [activeTab, setActiveTab] = useState("semua");
  const [variantSort, setVariantSort] = useState("reco");
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [addedVariantId, setAddedVariantId] = useState(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const addedFlashTimerRef = useRef(null);

  usePageMeta({
    title: product?.name ? `${product.name} | Detail Produk` : "Detail Produk",
    description: product?.description || "Pilih paket yang cocok, lanjut checkout.",
    ogImage: product?.icon_url || undefined,
  });

  // JSON-LD structured data for Google rich results
  useEffect(() => {
    if (!product) return;
    const existing = document.getElementById("jsonld-product");
    if (existing) existing.remove();

    const activeVariants = asVariantList(product.product_variants).filter((v) => v?.is_active);
    const range = getCatalogPriceRange(activeVariants, flashSaleMap);
    const minPrice = range.minPrice;
    const maxPrice = range.maxPrice;
    const totalStock = activeVariants.reduce((s, v) => s + Number(v.stock || 0), 0);

    const jsonld = {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": product.name,
      "description": product.description || "",
      "image": product.icon_url || "",
      "brand": { "@type": "Brand", "name": "Imzaqi Store" },
      "offers": {
        "@type": "AggregateOffer",
        "priceCurrency": "IDR",
        "lowPrice": minPrice,
        "highPrice": maxPrice,
        "offerCount": activeVariants.length,
        "availability": totalStock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      },
    };

    const script = document.createElement("script");
    script.id = "jsonld-product";
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(jsonld);
    document.head.appendChild(script);

    return () => { document.getElementById("jsonld-product")?.remove(); };
  }, [product, flashSaleMap]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError("");
        const [data, flashSales, topData] = await Promise.all([
          fetchProductBySlug(slug),
          fetchActiveFlashSales().catch(() => []),
          fetchTopSellingData().catch(() => ({ salesMap: {} })),
        ]);
        if (!alive) return;
        setProduct(normalizeProductRecord(data));
        setTopSalesMap(topData?.salesMap || {});
        const fsMap = new Map();
        (flashSales || []).forEach((sale) => fsMap.set(sale.variant_id, sale.discount_percent));
        setFlashSaleMap(fsMap);
      } catch (fetchError) {
        warn(fetchError);
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

  useEffect(() => {
    if (!product || recommendationsReady) return;
    const node = recommendationsRef.current;
    if (!node) return;

    const loadRecommendations = () => {
      setRecommendationsReady(true);
      fetchProducts()
        .then((productsData) => setAllProducts(productsData || []))
        .catch(() => setAllProducts([]));
    };

    if (typeof IntersectionObserver === "undefined") {
      loadRecommendations();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          loadRecommendations();
          observer.disconnect();
        }
      },
      { rootMargin: "240px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [product, recommendationsReady]);

  const variants = useMemo(
    () =>
      asVariantList(product?.product_variants)
        .slice()
        .filter((variant) => variant?.is_active)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    [product]
  );

  const categoryTabs = useMemo(() => {
    const tabs = new Set(variants.map((v) => classifyVariant(v.name)));
    const tabArr = [{ id: "semua", ...VARIANT_TAB_META.semua }];
    Object.entries(VARIANT_TAB_META).forEach(([id, meta]) => {
      if (id === "semua") return;
      if (tabs.has(id)) tabArr.push({ id, ...meta });
    });
    return tabArr;
  }, [variants]);

  const recommendedVariantId = useMemo(() => pickRecommendedVariant(variants, flashSaleMap), [variants, flashSaleMap]);
  const topSellerVariantId = useMemo(() => pickTopSellerVariant(variants), [variants]);

  const displayedVariants = useMemo(() => {
    const filtered =
      activeTab === "semua"
        ? variants.slice()
        : variants.filter((v) => classifyVariant(v.name) === activeTab);

    const inStockRank = (variant) => (Number(variant?.stock || 0) <= 0 ? 1 : 0);
    const byOrder = (a, b) => (a.sort_order || 0) - (b.sort_order || 0);

    return [...filtered].sort((a, b) => {
      if (variantSort === "price_asc") {
        const priceDiff =
          getVariantEffectivePrice(a, flashSaleMap) - getVariantEffectivePrice(b, flashSaleMap);
        if (priceDiff !== 0) return priceDiff;
        return byOrder(a, b);
      }

      if (variantSort === "popular") {
        const soldDiff = Number(b?.sold_count || 0) - Number(a?.sold_count || 0);
        if (soldDiff !== 0) return soldDiff;
        return (
          getVariantEffectivePrice(a, flashSaleMap) - getVariantEffectivePrice(b, flashSaleMap) ||
          byOrder(a, b)
        );
      }

      const stockDiff = inStockRank(a) - inStockRank(b);
      if (stockDiff !== 0) return stockDiff;
      if (topSellerVariantId) {
        if (a.id === topSellerVariantId) return -1;
        if (b.id === topSellerVariantId) return 1;
      }
      if (recommendedVariantId) {
        if (a.id === recommendedVariantId) return -1;
        if (b.id === recommendedVariantId) return 1;
      }
      return byOrder(a, b);
    });
  }, [variants, activeTab, variantSort, recommendedVariantId, topSellerVariantId, flashSaleMap]);

  const summary = useMemo(() => getCatalogPriceRange(variants, flashSaleMap), [variants, flashSaleMap]);

  useEffect(() => {
    if (!product?.id) return;
    addRecentlyViewed({
      ...product,
      _minPrice: summary.minPrice,
    });
  }, [product, summary.minPrice]);

  const soldTotal = useMemo(() => {
    if (product?.id && topSalesMap && topSalesMap[product.id] != null) {
      return topSalesMap[product.id];
    }
    const allVars = asVariantList(product?.product_variants);
    return allVars.reduce((sum, v) => sum + Math.max(0, Number(v?.sold_count || 0)), 0);
  }, [product, topSalesMap]);

  const maxVariantStock = useMemo(
    () => variants.length > 0 ? Math.max(1, ...variants.map((v) => Number(v.stock || 0))) : 1,
    [variants]
  );

  useEffect(() => {
    setActiveTab("semua");
    setVariantSort("reco");
  }, [slug]);

  useEffect(() => {
    if (!displayedVariants.length) {
      setSelectedVariantId(null);
      return;
    }
    setSelectedVariantId((current) => {
      if (current && displayedVariants.some((variant) => variant.id === current)) return current;
      return (
        displayedVariants.find((variant) => variant.id === topSellerVariantId)?.id ??
        displayedVariants.find((variant) => variant.id === recommendedVariantId)?.id ??
        displayedVariants[0]?.id ??
        null
      );
    });
  }, [displayedVariants, recommendedVariantId, topSellerVariantId]);

  useEffect(
    () => () => {
      if (addedFlashTimerRef.current) window.clearTimeout(addedFlashTimerRef.current);
    },
    []
  );

  const brandColor = useMemo(() => {
    const name = String(product?.name || "").toLowerCase();
    if (name.includes("zerogpt") || name.includes("cek ai")) return "rgba(14, 116, 144, 0.65)";
    if (name.includes("turnitin") || name.includes("plagiasi")) return "rgba(2, 132, 199, 0.65)";
    if (name.includes("parafrase") || name.includes("paraphrase")) return "rgba(16, 185, 129, 0.65)";
    if (name.includes("mendeley")) return "rgba(225, 29, 72, 0.65)";
    if (name.includes("netflix")) return "rgba(229, 9, 20, 0.65)";
    if (name.includes("canva")) return "rgba(0, 196, 204, 0.65)";
    if (name.includes("spotify")) return "rgba(29, 185, 84, 0.65)";
    if (name.includes("youtube")) return "rgba(255, 0, 0, 0.65)";
    if (name.includes("chatgpt")) return "rgba(16, 163, 127, 0.65)";
    if (name.includes("capcut")) return "rgba(0, 0, 0, 0.45)";
    if (name.includes("disney")) return "rgba(17, 60, 207, 0.65)";
    if (name.includes("prime")) return "rgba(0, 168, 225, 0.65)";
    if (name.includes("grammarly")) return "rgba(21, 128, 61, 0.65)";
    if (name.includes("claude")) return "rgba(217, 119, 6, 0.65)";
    if (name.includes("gemini")) return "rgba(99, 102, 241, 0.65)";
    if (name.includes("figma")) return "rgba(242, 78, 30, 0.65)";
    return "rgba(0, 194, 208, 0.55)";
  }, [product?.name]);

  const productCategory = useMemo(() => resolveProductCategory(product), [product]);
  const CategoryIcon = productCategory.icon;

  const selectedVariant = useMemo(
    () => displayedVariants.find((variant) => variant.id === selectedVariantId) || displayedVariants[0] || null,
    [displayedVariants, selectedVariantId]
  );
  const selectedEffectivePrice = useMemo(() => {
    if (!selectedVariant) return 0;
    return getVariantEffectivePrice(selectedVariant, flashSaleMap);
  }, [selectedVariant, flashSaleMap]);
  const recommendedVariant = useMemo(
    () => variants.find((variant) => variant.id === recommendedVariantId) || variants[0] || null,
    [variants, recommendedVariantId]
  );
  const guaranteePreview = useMemo(() => {
    const raw = String(recommendedVariant?.guarantee_text || "").trim();
    if (!raw) return "Garansi replace";
    return raw.toLowerCase().startsWith("garansi") ? raw : `Garansi ${raw}`;
  }, [recommendedVariant]);

  const recommendations = useMemo(() => {
    if (!product || !allProducts.length) return [];
    const currentLine = resolveCatalogLine(product);
    const currentCat = resolveProductCategory(product).key;

    return allProducts
      .filter((item) => item.id !== product.id)
      .filter((item) => item?.is_active !== false)
      .filter((item) => resolveCatalogLine(item) === currentLine)
      .map((item) => {
        let score = 0;
        const itemCat = resolveProductCategory(item).key;
        if (itemCat === currentCat && currentCat !== "other") score += 16;

        const variantsList = asVariantList(item.product_variants);
        const activeVariants = variantsList.filter((variant) => variant.is_active);
        const totalStock = activeVariants.reduce((sum, variant) => sum + Number(variant.stock || 0), 0);
        const totalSold = activeVariants.reduce((sum, variant) => sum + Number(variant.sold_count || 0), 0);

        if (totalStock > 0) score += 6;
        else score -= 4;
        score += Math.min(8, totalSold * 0.02);

        return { product: item, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((item) => item.product);
  }, [product, allProducts]);

  const productDescriptionText = useMemo(
    () => product?.description || "Pilih paket, checkout, selesai.",
    [product?.description]
  );

  const adminWhatsAppUrl = useMemo(() => {
    if (!product) return "";
    const pageUrl = typeof window === "undefined" ? "" : window.location.href;
    return buildCatalogAdminWhatsAppUrl(product, {
      minPriceLabel: summary.minPrice ? formatIDR(summary.minPrice) : "",
      pageUrl,
    });
  }, [product, summary.minPrice]);

  function handleAdd(variant, qty = 1, event) {
    const stock = Number(variant?.stock ?? 999);
    const requestedQty = Math.max(1, Math.floor(Number(qty) || 1));
    const cartQty = cart.items
      .filter((item) => item.variant_id === variant?.id)
      .reduce((sum, item) => sum + Number(item.qty || 0), 0);

    if (stock <= 0 || cartQty + requestedQty > stock) {
      const message = stock > 0
        ? `Stok tersisa ${stock}. Kurangi jumlah di keranjang terlebih dahulu.`
        : "Produk ini lagi abis";
      toast.error(message, { title: variant.name, duration: 3000 });
      return false;
    }

    const flashDiscount = flashSaleMap.get(variant.id);
    const effectivePrice =
      flashDiscount && flashDiscount > 0
        ? Math.round(variant.price_idr * (1 - flashDiscount / 100))
        : variant.price_idr;

    const res = cart.add(
      {
        ...variant,
        price_idr: effectivePrice,
        product_id: product.id,
        product_name: product.name,
        product_icon_url: product.icon_url || "",
        category: product.category,
      },
      requestedQty
    );

    if (res && res.conflict) {
      toast.warning(res.message, {
        title: "Pesanan Harus Terpisah",
        duration: 5000,
      });
      return false;
    }

    toast.success(`${variant.name} · ${formatIDR(effectivePrice)}`, {
      title: "Masuk keranjang",
      duration: 3200,
      actionLabel: "Intip keranjang",
      onAction: goCheckout,
    });

    setSelectedVariantId(variant.id);
    setAddedVariantId(variant.id);
    if (addedFlashTimerRef.current) window.clearTimeout(addedFlashTimerRef.current);
    addedFlashTimerRef.current = window.setTimeout(() => setAddedVariantId(null), 600);

    if (event?.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect();
      if (!caps.isMobile && !isMotionOff) {
        fireConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
        spawnCartFlyParticle(rect);
      }
      const btn = event.currentTarget;
      btn.classList.add("is-pressed");
      window.setTimeout(() => btn.classList.remove("is-pressed"), 180);
    }
    return true;
  }

  async function handleShare() {
    if (!product) return;
    const shareUrl = window.location.href;
    const minPrice = summary.minPrice ? ` - mulai ${formatIDR(summary.minPrice)}` : "";
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
    return <ProductDetailSkeleton />;
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
                description={error || "Produk gak tersedia."}
                primaryAction={{ label: "Balik ke katalog", onClick: goBackToCatalog }}
              />
            </div>
          </div>
        </section>
      </div>
    );
  }

  const icon = product.icon_url;

  return (
    <div className="page detail-page detail-page-v3">
      <section className="section">
        <div className="container">
          {/* On mobile, a plain div is used (no Framer Motion) to reduce JS overhead.
              The route-transition CSS class from Layout.jsx handles the page enter animation. */}
          <div className="pdx-layout">
            <div className="pdx-mainGrid">
              <div className="pdx-leftCol">
                <header className="pdx-topCard pdx-billboard">
                  <div className="pdx-visual">
                    <div className="pdx-visualIcon">
                      {icon ? (
                        <img src={icon} alt="" fetchPriority="high" decoding="async" />
                      ) : (
                        <span>{String(product.name || "P").slice(0, 1).toUpperCase()}</span>
                      )}
                    </div>
                  </div>

                  <div className="pdx-copy">
                  <div className="pdx-toolbar">
                    <button type="button" className="pdx-backLink" onClick={goBackToCatalog}>
                      <ArrowLeft size={15} />
                      <span>Katalog</span>
                    </button>

                    <div className="pdx-topActions">
                      <button type="button" className="pdx-iconBtn" onClick={handleShare} title="Bagikan">
                        <Share2 size={16} />
                      </button>
                    </div>
                  </div>

                      <Link
                        to={`/produk?cats=${productCategory.key}`}
                        className="pdx-label"
                        data-category={productCategory.key}
                        aria-label={`Lihat produk kategori ${productCategory.label}`}
                      >
                        <CategoryIcon size={12} aria-hidden="true" />
                        <span>{productCategory.label}</span>
                      </Link>
                      <h1 className="pdx-title">{product.name}</h1>

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
                      <span className="pdx-heroStat" title={guaranteePreview}>
                        <ShieldCheck size={13} />
                        {guaranteePreview}
                      </span>
                    </div>
                    {adminWhatsAppUrl ? (
                      <a
                        className="pdx-contactAdmin"
                        href={adminWhatsAppUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MessageCircle size={16} aria-hidden="true" />
                        <span>Hubungi Admin</span>
                      </a>
                    ) : null}
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
                <AccountTypeStrip variants={variants} />

                <div className="pdx-variantsHead">
                  <div className="pdx-variantsTitleRow">
                    <h2 className="pdx-sectionTitle">Paket</h2>
                    {variants.length > 1 ? (
                      <button className="pdx-compareBtn" type="button" onClick={() => setCompareOpen(true)}>
                        <span className="pdx-compareIcon" aria-hidden="true">⇄</span>
                        <span className="pdx-compareLabel">Bandingkan paket</span>
                      </button>
                    ) : null}
                  </div>
                </div>

                {variants.length > 1 ? (
                  <div className="pdx-sortBar">
                    <div className="pdx-filters pdx-sortFilters" role="toolbar" aria-label="Urutkan paket">
                      {VARIANT_SORTS.map((sort) => {
                        const active = variantSort === sort.id;
                        const Icon = sort.icon;
                        return (
                          <button
                            key={sort.id}
                            type="button"
                            onClick={() => setVariantSort(sort.id)}
                            className={`pdx-filterChip ${active ? "is-active" : ""}`}
                            aria-pressed={active}
                          >
                            {active && Icon ? <Icon size={14} strokeWidth={2.2} aria-hidden="true" /> : null}
                            {sort.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {categoryTabs.length > 2 ? (
                  <div className="pdx-filters" role="toolbar" aria-label="Kategori paket">
                    {categoryTabs.map((tab) => {
                      const active = activeTab === tab.id;
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveTab(tab.id)}
                          className={`pdx-filterChip ${active ? "is-active" : ""}`}
                          aria-pressed={active}
                        >
                          {active && Icon ? <Icon size={14} strokeWidth={2.2} aria-hidden="true" /> : null}
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                <div className="pdx-packList" key={variantSort}>
                  {displayedVariants.length === 0 ? (
                    <div className="pdx-emptyCard">
                      <EmptyState
                        icon="-"
                        title={variants.length === 0 ? "Belum ada paket" : "Gak ada paket di kategori ini"}
                        description={
                          variants.length === 0
                            ? "Admin belum nambahin varian buat produk ini."
                            : "Coba pilih kategori lain atau intip semua paket."
                        }
                        primaryAction={
                          variants.length > 0
                            ? { label: "Intip semua", onClick: () => setActiveTab("semua") }
                            : { label: "Balik ke katalog", onClick: goBackToCatalog }
                        }
                      />
                    </div>
                  ) : (
                    displayedVariants.map((variant) => {
                      const stock = Number(variant.stock ?? 0);
                      const out = stock <= 0;
                      // Same card UI for 1-variant and multi-variant
                      const isRecommended = variant.id === recommendedVariantId || variant.id === topSellerVariantId;
                      const flashDiscount = flashSaleMap.get(variant.id);
                      const effectivePrice =
                        flashDiscount && flashDiscount > 0
                          ? Math.round(variant.price_idr * (1 - flashDiscount / 100))
                          : variant.price_idr;
                      const descriptionBody = String(
                        variant.description ||
                          (out
                            ? "Slot lagi abis. Cek lagi kalo stok udah kebuka."
                            : "Varian siap diproses abis pembayaran diverifikasi.")
                      )
                        .replace(/\r\n/g, " ")
                        .trim();

                      return (
                        <VariantCard
                          key={variant.id}
                          variant={variant}
                          siblingVariants={variants}
                          isSelected={selectedVariantId === variant.id}
                          isAdded={addedVariantId === variant.id}
                          isRecommended={isRecommended}
                          isTopSeller={variant.id === topSellerVariantId}
                          flashDiscount={flashDiscount}
                          effectivePrice={effectivePrice}
                          descriptionBody={descriptionBody}
                          isMotionOff={isMotionOff}
                          motionMode={motionMode}
                          maxVariantStock={maxVariantStock}
                          onSelect={setSelectedVariantId}
                          onAdd={handleAdd}
                          onBuy={(v, q, e) => {
                            if (handleAdd(v, q, e)) goCheckout();
                          }}
                        />
                      );
                    })
                  )}
                </div>

              </section>
            </div>
          </div>

          <RecentlyViewed currentProductId={product.id} />

          <section className="pdx-recommendations" ref={recommendationsRef} aria-label="Rekomendasi produk">
            <div className="pdx-recommendationsHead">
              <h2 className="pdx-sectionTitle">Rekomendasi</h2>
            </div>
            {recommendations.length > 0 ? (
              <div className="product-grid-container grid-mode pdx-recommendationsGrid" role="list">
                {recommendations.map((p) => (
                  <ProductTile key={p.id} product={p} layout="grid" disableTilt={true} />
                ))}
              </div>
            ) : recommendationsReady ? (
              <p className="pdx-recommendationsEmpty">Belum ada rekomendasi lain untuk produk ini.</p>
            ) : null}
          </section>
        </div>
      </div>
    </section>

    <VariantCompareModal
      open={compareOpen}
      variants={displayedVariants}
      flashSaleMap={flashSaleMap}
      onClose={() => setCompareOpen(false)}
    />
  </div>
  );
}
