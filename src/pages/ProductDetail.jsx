import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { productStructuredData } from "../lib/productStructuredData.mjs";
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flame,
  Images,
  LayoutGrid,
  Share2,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  ThumbsUp,
  UserRound,
  Users,
  Bell,
  PackageCheck,
  X,
  ZoomIn,
} from "lucide-react";

import { fetchProductBySlug, fetchActiveFlashSales, fetchTopSellingData, fetchTestimonials } from "../lib/api";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { asVariantList, formatGuaranteeLabel, formatIDR, formatTestimonialDate, getCatalogPriceRange, getProductIconTone, isKnownOutOfStock, normalizeProductRecord, packDisplayName } from "../lib/format";
import { usePageMeta } from "../hooks/usePageMeta";
import EmptyState from "../components/EmptyState";
import { useAdaptiveMotion } from "../hooks/useAdaptiveMotion";
import { useDeviceCapability } from "../hooks/useIsMobile";
import VariantCompareModal from "../components/VariantCompareModal";
import { useLongTaskMonitor } from "../hooks/usePerformanceMonitor";
import { useDialogA11y } from "../hooks/useDialogA11y";
import { warn } from "../lib/log";
import { fireConfetti } from "../components/Confetti";

// Live viewer & countdown removed (fake data - hurts trust)
import { spawnCartFlyParticle } from "../lib/cartFlyParticle";
import { getCatalogReturnPath, hasSavedScrollY } from "../hooks/useScrollMemory";
import { buildCatalogAdminWhatsAppUrl, buildSupportWhatsAppUrl, resolveCatalogLine, resolveProductCategory } from "../lib/productCategories";
import { getTransitionProductSlug, runViewTransition } from "../lib/viewTransition";
import MobileProductBar from "../components/MobileProductBar";
import { trackFunnelEvent } from "../lib/funnelAnalytics";

function WhatsAppIcon({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2Zm5.82 14.01c-.25.7-1.43 1.33-2 1.42-.51.08-1.15.11-1.85-.11-.43-.14-.98-.32-1.69-.63-2.96-1.28-4.9-4.27-5.05-4.47-.15-.2-1.21-1.61-1.21-3.07s.76-2.18 1.03-2.48c.27-.3.6-.37.8-.37.2 0 .4.01.57.01.18.01.43-.07.67.51.25.6.85 2.08.92 2.23.08.15.13.33.03.53-.1.2-.15.33-.3.5-.15.17-.32.38-.45.51-.15.15-.31.31-.13.61.18.3.79 1.3 1.7 2.11 1.17 1.04 2.15 1.36 2.45 1.51.3.15.48.13.66-.08.18-.2.75-.88.95-1.18.2-.3.4-.25.67-.15.28.1 1.75.83 2.05.98.3.15.5.23.58.35.08.13.08.73-.17 1.43Z" />
    </svg>
  );
}

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
  const text = String(rawText || "").replace(/\r\n/g, "\n").trim();
  if (!text) return [];

  const tokens = text
    .replace(/^[-•]\s*/, "")
    .split(/\s+[-•]\s+/)
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

function VariantBenefitList({ rawText }) {
  const sections = parseDescriptionToSections(rawText);
  if (!sections.length) return null;

  // Tampilkan 2 poin penting langsung tanpa harus membuka akordeon
  const previewItems = [];
  for (const s of sections) {
    for (const it of s.items) {
      if (previewItems.length < 2 && it && it.trim()) {
        previewItems.push(it.trim());
      }
    }
    if (previewItems.length >= 2) break;
  }

  if (!previewItems.length) return null;

  return (
    <div className="pdx-packDetails">
      <ul className="pdx-packHighlights" aria-label="Highlight paket">
        {previewItems.map((item, i) => (
          <li key={i} className="pdx-packHighlightItem">
            <Check size={12} className="pdx-packHighlightIcon" aria-hidden="true" />
            <span>{normalizeInlineText(item)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RestockRequest({ product, variant, adminUrl }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [state, setState] = useState("idle");

  function submit(event) {
    event.preventDefault();
    let digits = phone.replace(/\D/g, "");
    if (digits.startsWith("08")) {
      digits = "628" + digits.slice(2);
    } else if (digits.startsWith("8")) {
      digits = "628" + digits.slice(1);
    }
    if (digits.length < 10) {
      setState("invalid");
      return;
    }

    const productLabel = product?.name ? `${product.name} - ` : "";
    const packLabel = [variant?.name, variant?.duration_label].filter(Boolean).join(" · ") || "produk";
    const msg = `Halo Admin Imzaqi Store, mohon kabari saat paket *${productLabel}${packLabel}* ready kembali ya (WA saya: ${digits}).`;
    const baseUrl = adminUrl ? adminUrl.split("?")[0] : "";
    const waLink = baseUrl
      ? `${baseUrl}?text=${encodeURIComponent(msg)}`
      : buildSupportWhatsAppUrl(msg, resolveCatalogLine(product));

    try {
      window.open(waLink, "_blank", "noopener,noreferrer");
    } catch {}
    setState("done");
    trackFunnelEvent("restock_request", { productId: variant?.product_id || product?.id, variantId: variant?.id });
  }

  if (state === "done") {
    return (
      <div className="pdx-restockDone">
        <Bell size={14} /> Permintaan restock diteruskan ke WhatsApp admin.
      </div>
    );
  }

  return (
    <div className="pdx-restock">
      <div className="pdx-restockActions">
        <button
          className="btn btn-sm pdx-restockBtn"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setOpen((value) => !value);
          }}
        >
          <Bell size={14} />
          <span>Kabari saat ready</span>
        </button>
        {adminUrl ? (
          <a
            className="btn btn-sm btn-ghost pdx-restockAdminBtn"
            href={adminUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
          >
            Tanya admin
          </a>
        ) : null}
      </div>
      {open ? (
        <form onSubmit={submit} onClick={(event) => event.stopPropagation()}>
          <input
            className="input"
            inputMode="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="WhatsApp 08xxxxxxxxxx"
            aria-label="WhatsApp untuk notifikasi restock"
          />
          <button className="btn btn-sm pdx-restockSubmitBtn" disabled={state === "loading"}>
            {state === "loading" ? "Menyimpan..." : "Ingatkan saya"}
          </button>
          {state === "invalid" ? (
            <small>Masukkan nomor WhatsApp yang valid.</small>
          ) : state === "error" ? (
            <small>Belum bisa disimpan. Coba lagi.</small>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}

function parseDays(label) {
  const match = String(label || "").match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function getPricePerMonth(variant, price) {
  if (!variant || !price) return null;
  const text = `${variant.duration_label || ""} ${variant.name || ""}`;
  const monthMatch = text.match(/(\d+)\s*(?:bln|bulan|month)/i);
  if (monthMatch) {
    const months = parseInt(monthMatch[1], 10);
    if (months > 1) {
      return Math.round(price / months);
    }
  }
  const yearMatch = text.match(/(\d+)\s*(?:thn|tahun|year)/i);
  if (yearMatch) {
    const years = parseInt(yearMatch[1], 10);
    if (years >= 1) {
      return Math.round(price / (years * 12));
    }
  }
  return null;
}

function pickRecommendedVariant(variants, flashSaleMap) {
  const source = variants.filter((variant) => !isKnownOutOfStock(variant));
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
  const source = variants.filter((variant) => !isKnownOutOfStock(variant));
  const target = source.length ? source : variants;
  if (!target.length) return null;
  const ranked = target
    .slice()
    .sort((a, b) => Number(b?.sold_count || 0) - Number(a?.sold_count || 0));
  if (Number(ranked[0]?.sold_count || 0) <= 0) return null;
  return ranked[0]?.id;
}

const VARIANT_SORTS = [
  { id: "reco", label: "Rekomendasi", icon: ThumbsUp },
  { id: "price_asc", label: "Termurah", icon: ArrowDown },
  { id: "popular", label: "Terlaris", icon: Flame },
];

const VARIANT_TAB_META = {
  semua: { label: "Semua", icon: LayoutGrid },
  bulanan: { label: "Bulanan", icon: Clock3 },
  tahunan: { label: "Tahunan", icon: Clock3 },
  lifetime: { label: "Lifetime", icon: ShieldCheck },
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
  if (/\b(sharing|share)\b/.test(n)) return "sharing";
  if (/\b(private|privat)\b/.test(n)) return "private";
  if (/\b(family|keluarga)\b/.test(n)) return "family";
  if (/\b(membership|member)\b/.test(n)) return "membership";
  if (/\b(topup|top up)\b/.test(n)) return "topup";
  if (/\b(lifetime|selamanya)\b/.test(n)) return "lifetime";
  if (/\b(bulanan|\d+\s*bulan)\b/.test(n)) return "bulanan";
  if (/\b(tahunan|\d+\s*tahun)\b/.test(n)) return "tahunan";
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
    let active = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (active) setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(imgRef.current);
    return () => {
      active = false;
      observer.disconnect();
    };
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
  product,
  variant,
  siblingVariants,
  isRecommended,
  isTopSeller,
  flashDiscount,
  effectivePrice,
  descriptionBody,
  onAdd,
  onBuy,
  adminUrl,
}) => {
  const stock = variant.stock == null || variant.stock === "" ? null : Number(variant.stock);
  const soldCount = Math.max(0, Number(variant.sold_count || 0));
  const out = isKnownOutOfStock(variant);
  const lowStock = !out && Number.isFinite(stock) && stock <= 5;

  const cardProps = {
    className: [
      "pdx-packCard",
      out ? "is-out" : "",
      isRecommended ? "is-recommended" : "",
    ]
      .filter(Boolean)
      .join(" "),
  };

  const guaranteeLabel = formatGuaranteeLabel(variant.guarantee_text);
  const durationLabel = String(variant.duration_label || "").replace(/^durasi\s+/i, "").trim();
  const factItems = [
    durationLabel || null,
    guaranteeLabel || null,
    variant.requires_buyer_email ? "Perlu email" : null,
  ].filter(Boolean);

  const pricePerMonth = getPricePerMonth(variant, effectivePrice);

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
            {pricePerMonth ? (
              <div className="pdx-pricePerMonth" style={{ fontSize: "11px", opacity: 0.75, textAlign: "right", marginTop: "2px" }}>
                ({formatIDR(pricePerMonth)}/bln)
              </div>
            ) : null}
          </div>
        </div>

        {factItems.length ? (
          <p className="pdx-packFacts">
            {factItems.map((item, index) => (
              <span key={`${item}-${index}`} className={index === 0 && durationLabel ? "pdx-packDuration" : undefined}>{item}</span>
            ))}
          </p>
        ) : null}
      </div>

      <div className="pdx-packCommerce" aria-label="Ketersediaan dan penjualan varian">
        <span className={`pdx-packSignal pdx-packStock${out ? " is-out" : lowStock ? " is-low" : ""}`}>
          <PackageCheck className="pdx-packSignalIcon" size={12} aria-hidden="true" />
          {out ? "Stok habis" : stock == null || !Number.isFinite(stock) ? "Tersedia" : lowStock ? `Sisa ${stock}` : `Stok ${stock}`}
        </span>
        <span className="pdx-packSignal pdx-packSold">
          <ShoppingBag size={12} aria-hidden="true" />
          {soldCount} terjual
        </span>
      </div>

      <VariantBenefitList
        rawText={descriptionBody}
      />

      {out ? <RestockRequest product={product} variant={variant} adminUrl={adminUrl} /> : <div className="pdx-packActions">
        <button
          className={`btn btn-sm btn-ghost pdx-addBtn ${out ? "btn-disabled" : ""}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAdd(variant, 1, e);
          }}
          disabled={out}
          aria-label={`Tambah ${packDisplayName(variant, siblingVariants)} ke keranjang`}
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
          {out ? "Stok habis" : "Beli sekarang"}
        </button>
      </div>}
    </>
  );

  return <article {...cardProps}>{cardChildren}</article>;
});

VariantCard.displayName = "VariantCard";

function ProductInfoTabs({ productDescriptionText }) {
  const [activeInfoTab, setActiveInfoTab] = useState("description");

  return (
    <div className="pdx-infoTabsCard">
      <div className="pdx-infoTabsHeader" role="group" aria-label="Informasi produk">
        <button
          type="button"
          className={`pdx-infoTabBtn ${activeInfoTab === "description" ? "is-active" : ""}`}
          aria-pressed={activeInfoTab === "description"}
          onClick={() => setActiveInfoTab("description")}
        >
          <span className="pdx-infoTabLabel">Deskripsi</span>
        </button>
        <button
          type="button"
          className={`pdx-infoTabBtn ${activeInfoTab === "terms" ? "is-active" : ""}`}
          aria-pressed={activeInfoTab === "terms"}
          onClick={() => setActiveInfoTab("terms")}
        >
          <span className="pdx-infoTabLabel">Syarat &amp; Ketentuan</span>
        </button>
      </div>
      <div className="pdx-infoTabContent" role="region" aria-label={activeInfoTab === "description" ? "Deskripsi produk" : "Syarat dan ketentuan"}>
        {activeInfoTab === "description" ? (
          <ProductDescription text={productDescriptionText} />
        ) : (
          <ol className="pdx-termsList">
            <li>
              <span className="pdx-termNum">1</span>
              <span className="pdx-termText">Pembayaran diverifikasi otomatis via QRIS. Simpan ID Order (IMZ-XXXX) sebagai bukti sah.</span>
            </li>
            <li>
              <span className="pdx-termNum">2</span>
              <span className="pdx-termText">Pengiriman dilakukan via WhatsApp dalam 5 sampai 30 menit pada jam operasional 08.00 sampai 22.00 WIB.</span>
            </li>
            <li>
              <span className="pdx-termNum">3</span>
              <span className="pdx-termText">Akun Sharing: Akun digunakan oleh 2-4 user. Dilarang otak-atik, jika ketahuan denda &amp; garansi hangus.</span>
            </li>
            <li>
              <span className="pdx-termNum">4</span>
              <span className="pdx-termText">Akun Private: 1 akun/profil penuh milikmu. Bebas login tanpa kendala tertabrak dan tanpa takut privasi tersebar.</span>
            </li>
            <li>
              <span className="pdx-termNum">5</span>
              <span className="pdx-termText">Garansi replace berlaku sesuai durasi paket. Klaim kendala wajib menyertakan ID Order ke WhatsApp admin.</span>
            </li>
          </ol>
        )}
      </div>
    </div>
  );
}

function ProductDetailSkeleton() {
  return (
    <div className="page detail-page detail-page-v3 pdx-skeletonPage" aria-busy="true" aria-live="polite" aria-label="Memuat detail produk">
      <section className="section">
        <div className="container">
          <div className="pdx-layout">
            <div className="pdx-mainGrid pdx-skeletonGrid">
              <div className="pdx-leftCol">
                <header className="pdx-topCard pdx-billboard pdx-skeletonHero">
                  <div className="pdx-visual pdx-skeletonVisual">
                    <div className="pdx-visualIcon pdx-skeletonVisualIcon">
                      <div className="pdx-skel pdx-skelHeroIcon" />
                    </div>
                  </div>

                  <div className="pdx-copy pdx-skeletonCopy">
                    <div className="pdx-toolbar">
                      <div className="pdx-skel pdx-skelToolbarBtn" />
                      <div className="pdx-skel pdx-skelToolbarIcon" />
                    </div>

                    <div className="pdx-skel pdx-skelBadge" />
                    <div className="pdx-skel pdx-skelTitle" />

                    <div className="pdx-statsStrip pdx-skeletonStats">
                      <div className="pdx-skel pdx-skelPriceBox" />
                      <div className="pdx-skeletonChipsRow">
                        <div className="pdx-skel pdx-skelStatChip" />
                        <div className="pdx-skel pdx-skelStatChip" />
                      </div>
                    </div>
                  </div>
                </header>

                <div className="pdx-infoTabsCard pdx-skeletonTabsCard">
                  <div className="pdx-skeletonTabNav">
                    <div className="pdx-skel pdx-skelTabBtn is-active" />
                    <div className="pdx-skel pdx-skelTabBtn" />
                    <div className="pdx-skel pdx-skelTabBtn" />
                  </div>
                  <div className="pdx-skeletonTabBody">
                    <div className="pdx-skel pdx-skelLine" style={{ width: "92%", height: 16, borderRadius: 6 }} />
                    <div className="pdx-skel pdx-skelLine" style={{ width: "84%", height: 16, borderRadius: 6, marginTop: 10 }} />
                    <div className="pdx-skel pdx-skelLine" style={{ width: "68%", height: 16, borderRadius: 6, marginTop: 10 }} />
                  </div>
                </div>
              </div>

              <div className="pdx-rightCol">
                <section className="pdx-variantsSection pdx-skeletonVariants">
                  <div className="pdx-variantsHead">
                    <div className="pdx-variantsTitleRow">
                      <div className="pdx-skel pdx-skelLine" style={{ width: 80, height: 26, borderRadius: 8 }} />
                      <div className="pdx-skel pdx-skelLine" style={{ width: 140, height: 26, borderRadius: 8 }} />
                    </div>
                  </div>

                  <div className="pdx-skeletonFilterRow">
                    <div className="pdx-skel pdx-skelChip" style={{ width: 110, height: 36 }} />
                    <div className="pdx-skel pdx-skelChip" style={{ width: 90, height: 36 }} />
                    <div className="pdx-skel pdx-skelChip" style={{ width: 90, height: 36 }} />
                  </div>

                  <div className="pdx-packList">
                    {[1, 2].map((idx) => (
                      <div key={idx} className="pdx-packCard pdx-skeletonPackCard">
                        <div className="pdx-packHead">
                          <div className="pdx-packTitleRow">
                            <div className="pdx-skel pdx-skelLine" style={{ width: "55%", height: 22, borderRadius: 6 }} />
                            <div className="pdx-skel pdx-skelLine" style={{ width: 85, height: 24, borderRadius: 6 }} />
                          </div>
                          <div className="pdx-skel pdx-skelLine" style={{ width: "38%", height: 14, marginTop: 8, borderRadius: 4 }} />
                        </div>

                        <div className="pdx-packCommerce" style={{ marginTop: 12 }}>
                          <div className="pdx-skel pdx-skelLine" style={{ width: 68, height: 20, borderRadius: 999 }} />
                          <div className="pdx-skel pdx-skelLine" style={{ width: 78, height: 20, borderRadius: 999 }} />
                        </div>

                        <div className="pdx-skel pdx-skelLine" style={{ width: "85%", height: 14, marginTop: 14, borderRadius: 4 }} />

                        <div className="pdx-packActions" style={{ marginTop: 16 }}>
                          <div className="pdx-skel pdx-skelActionBtn pdx-skelActionBtn--cart" />
                          <div className="pdx-skel pdx-skelActionBtn pdx-skelActionBtn--buy" />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function ProductDetail() {
  const { slug } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const catalogBackTo = getCatalogReturnPath();
  const goBackToCatalog = useCallback(() => {
    const cameFromCatalog = Boolean(location.state?.fromCatalog) || hasSavedScrollY();
    const targetSlug = slug;
    if (typeof document !== "undefined") {
      const iconEl = document.querySelector(".detail-page-v3 .pdx-visualIcon");
      const titleEl = document.querySelector(".detail-page-v3 .pdx-title");
      if (iconEl && targetSlug) iconEl.style.viewTransitionName = `product-icon-${targetSlug}`;
      if (titleEl && targetSlug) titleEl.style.viewTransitionName = `product-title-${targetSlug}`;
    }
    runViewTransition(
      () => {
        if (cameFromCatalog && window.history.length > 1) {
          nav(-1);
          return;
        }
        nav(catalogBackTo);
      },
      { slug: targetSlug }
    );
  }, [catalogBackTo, location.state, nav, slug]);
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
  const [error, setError] = useState("");
  const [flashSaleMap, setFlashSaleMap] = useState(new Map());
  const [topSalesMap, setTopSalesMap] = useState({});
  const [activeTab, setActiveTab] = useState("semua");
  const [variantSort, setVariantSort] = useState("reco");
  const [compareOpen, setCompareOpen] = useState(false);
  const [testimonials, setTestimonials] = useState([]);
  const [previewTestimonialIdx, setPreviewTestimonialIdx] = useState(-1);
  const testimonialDialogRef = useRef(null);
  const closeTestimonialViewer = useCallback(() => setPreviewTestimonialIdx(-1), []);

  // Ensure product detail opens cleanly scrolled at top on first entry or slug change.
  useLayoutEffect(() => {
    if (typeof window === "undefined" || window.location.hash) return undefined;
    const scrollTopNow = () => {
      try {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      } catch {
        window.scrollTo(0, 0);
      }
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    };
    scrollTopNow();
    const rafId = requestAnimationFrame(scrollTopNow);
    return () => cancelAnimationFrame(rafId);
  }, [slug, loading]);

  usePageMeta({
    title: product?.name ? `${product.name} | Detail Produk` : "Detail Produk",
    description: product?.description || "Pilih paket yang cocok, lanjut checkout.",
    ogImage: product?.icon_url || undefined,
  });

  // Shared with build-time metadata; replace the same script on SPA navigation.
  useEffect(() => {
    if (!product) return;
    const existing = document.getElementById("jsonld-product");
    if (existing) existing.remove();

    const activeVariants = asVariantList(product.product_variants).filter((v) => v?.is_active !== false);
    const range = getCatalogPriceRange(activeVariants, flashSaleMap);
    const minPrice = range.minPrice;
    const maxPrice = range.maxPrice;
    const totalStock = activeVariants.reduce((s, v) => s + Number(v.stock || 0), 0);

    const jsonld = productStructuredData(product, {
      min: minPrice, max: maxPrice, count: activeVariants.length, stock: totalStock,
    });

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
        (flashSales || []).forEach((sale) => {
          if (!fsMap.has(sale.variant_id)) {
            fsMap.set(sale.variant_id, sale.discount_percent);
          }
        });
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

  const variants = useMemo(
    () =>
      asVariantList(product?.product_variants)
        .slice()
        .filter((variant) => variant?.is_active !== false)
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

    const inStockRank = (variant) => (isKnownOutOfStock(variant) ? 1 : 0);
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

  const soldTotal = useMemo(() => {
    const allVars = asVariantList(product?.product_variants);
    const variantSold = allVars.reduce((sum, v) => sum + Math.max(0, Number(v?.sold_count || 0)), 0);
    const rpcSold = product?.id && topSalesMap && topSalesMap[product.id] != null
      ? Math.max(0, Number(topSalesMap[product.id] || 0))
      : 0;
    return Math.max(rpcSold, variantSold);
  }, [product, topSalesMap]);

  useEffect(() => {
    setActiveTab("semua");
    setVariantSort("reco");
  }, [slug]);

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

  useEffect(() => {
    let alive = true;
    if (typeof fetchTestimonials !== "function") return undefined;
    fetchTestimonials()
      .then((rows) => {
        if (alive) setTestimonials(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const productTestimonials = useMemo(() => {
    if (!product || !Array.isArray(testimonials) || testimonials.length === 0) return [];
    const productNameLower = String(product.name || "").trim().toLowerCase();
    return testimonials.filter((item) => {
      if (!item?.image_url) return false;
      if (item.product_id && String(item.product_id) === String(product.id)) return true;
      const itemProductName = String(item.product_name || "").trim().toLowerCase();
      if (productNameLower && itemProductName === productNameLower) return true;
      if (productNameLower && item.caption) {
        return String(item.caption).toLowerCase().includes(`(${productNameLower})`);
      }
      return false;
    });
  }, [product, testimonials]);

  const activeTestimonial =
    previewTestimonialIdx >= 0 ? productTestimonials[previewTestimonialIdx] || null : null;

  useEffect(() => {
    setPreviewTestimonialIdx(-1);
  }, [slug]);

  useDialogA11y({
    open: Boolean(activeTestimonial),
    containerRef: testimonialDialogRef,
    onClose: closeTestimonialViewer,
  });

  useEffect(() => {
    if (!activeTestimonial) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event) {
      if (productTestimonials.length > 1 && event.key === "ArrowLeft") {
        event.preventDefault();
        setPreviewTestimonialIdx(
          (i) => (i - 1 + productTestimonials.length) % productTestimonials.length
        );
      } else if (productTestimonials.length > 1 && event.key === "ArrowRight") {
        event.preventDefault();
        setPreviewTestimonialIdx((i) => (i + 1) % productTestimonials.length);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [Boolean(activeTestimonial), productTestimonials.length]);

  const guaranteePreview = useMemo(() => {
    const labels = [...new Set(variants.map((variant) => formatGuaranteeLabel(variant.guarantee_text)).filter(Boolean))];
    return labels.length === 1 ? labels[0] : "Garansi sesuai paket";
  }, [variants]);

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

  useEffect(() => {
    if (!product?.id) return;
    trackFunnelEvent("view_product", { productId: product.id, metadata: { slug: product.slug } });
  }, [product?.id, product?.slug]);

  function handleAdd(variant, qty = 1, event) {
    const hasStockLimit = variant?.stock != null && variant?.stock !== "" && !isNaN(Number(variant?.stock));
    const stock = hasStockLimit ? Number(variant.stock) : 999;
    const requestedQty = Math.max(1, Math.floor(Number(qty) || 1));
    const cartQty = cart.items
      .filter((item) => item.variant_id === variant?.id)
      .reduce((sum, item) => sum + Number(item.qty || 0), 0);

    if (hasStockLimit && (stock <= 0 || cartQty + requestedQty > stock)) {
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

    if (res && !res.success) {
      if (res.conflict) {
        toast.warning(res.message, {
          title: "Pesanan Harus Terpisah",
          duration: 5000,
        });
      } else if (res.message) {
        toast.error(res.message, { title: variant.name, duration: 3000 });
      }
      return false;
    }

    toast.success(`${variant.name} · ${formatIDR(effectivePrice)}`, {
      title: "Masuk keranjang",
      duration: 3200,
      actionLabel: "Intip keranjang",
      onAction: goCheckout,
    });
    trackFunnelEvent("add_to_cart", { productId: product.id, variantId: variant.id, metadata: { qty: requestedQty, price: effectivePrice } });

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
  const activeSlug = product.slug || slug;
  const isVtActive = getTransitionProductSlug() === activeSlug;

  return (
    <div className="page detail-page detail-page-v3 pdx-contentLoaded">
      <section className="section">
        <div className="container">
          <MobileProductBar name={product.name} icon={icon} onBack={goBackToCatalog} />
          <div className="pdx-layout">
            <div className="pdx-mainGrid">
              <div className="pdx-leftCol">
                <header className="pdx-topCard pdx-billboard">
                  <div className="pdx-visual">
                    <div
                      className="pdx-visualIcon"
                      data-brand-icon={getProductIconTone(product) || undefined}
                      style={isVtActive ? { viewTransitionName: `product-icon-${activeSlug}` } : undefined}
                    >
                      {icon ? (
                        <img src={icon} alt="" fetchPriority="high" decoding="async" />
                      ) : (
                        <span>{String(product.name || "P").slice(0, 1).toUpperCase()}</span>
                      )}
                    </div>
                  </div>

                  <div className="pdx-copy">
                    <div className="pdx-toolbar">
                      <button type="button" className="pdx-backLink" onClick={goBackToCatalog} aria-label="Kembali ke katalog">
                        <ChevronLeft size={18} strokeWidth={2.4} aria-hidden="true" />
                        <span>Katalog</span>
                      </button>

                      <div className="pdx-topActions">
                        <Link
                          to={`/produk?cats=${productCategory.key}`}
                          className="pdx-label pdx-categoryPill"
                          data-category={productCategory.key}
                          aria-label={`Lihat produk kategori ${productCategory.label}`}
                        >
                          <CategoryIcon size={12} aria-hidden="true" />
                          <span>{productCategory.label}</span>
                        </Link>
                        <button type="button" className="pdx-iconBtn" onClick={handleShare} title="Bagikan" aria-label="Bagikan produk">
                          <Share2 size={16} />
                        </button>
                      </div>
                    </div>

                    <h1
                      className="pdx-title"
                      style={isVtActive ? { viewTransitionName: `product-title-${activeSlug}` } : undefined}
                    >
                      {product.name}
                    </h1>

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
                        <WhatsAppIcon size={16} />
                        <span>Tanya Admin!</span>
                      </a>
                    ) : null}
                  </div>
                  </div>
                </header>

                <ProductInfoTabs
                  productDescriptionText={productDescriptionText}
                />
              </div>

            <div className="pdx-rightCol">
              <section id="paket-tersedia" className="pdx-variantsSection">
                <div className="pdx-variantsHead">
                  <div className="pdx-variantsTitleRow">
                    <h2 className="pdx-sectionTitle">Pilih paketmu</h2>
                    {variants.length > 1 ? (
                      <button className="pdx-compareBtn" type="button" title="Bandingkan harga, durasi, dan garansi" onClick={() => setCompareOpen(true)}>
                        <ArrowLeftRight size={13} className="pdx-compareIcon" aria-hidden="true" />
                        <span className="pdx-compareLabel">Bandingkan paket</span>
                      </button>
                    ) : null}
                  </div>
                </div>

                {variants.length > 1 ? (
                  <div className="pdx-packControls" aria-label="Atur tampilan paket">
                    <div className="pdx-controlGroup" role="group" aria-label="Urutkan paket">
                      <span className="pdx-controlLabel">Urutkan</span>
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
                    {categoryTabs.length > 2 ? (
                      <div className="pdx-controlGroup" role="group" aria-label="Jenis paket">
                        <span className="pdx-controlLabel">Jenis</span>
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
                            ? "Paket untuk produk ini belum tersedia."
                            : "Pilih kategori lain atau tampilkan semua paket."
                        }
                        primaryAction={
                          variants.length > 0
                            ? { label: "Lihat semua", onClick: () => setActiveTab("semua") }
                            : { label: "Kembali ke katalog", onClick: goBackToCatalog }
                        }
                      />
                    </div>
                  ) : (
                    displayedVariants.map((variant) => {
                      const out = isKnownOutOfStock(variant);
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
                      ).trim();

                      return (
                        <VariantCard
                          key={variant.id}
                          product={product}
                          variant={variant}
                          siblingVariants={variants}
                          isRecommended={isRecommended}
                          isTopSeller={variant.id === topSellerVariantId}
                          flashDiscount={flashDiscount}
                          effectivePrice={effectivePrice}
                          descriptionBody={descriptionBody}
                          onAdd={handleAdd}
                          onBuy={(v, q, e) => {
                            const isAlreadyInCart = (cart.items || []).some((it) => it.variant_id === v.id);
                            if (isAlreadyInCart) {
                              trackFunnelEvent("buy_now", { productId: product.id, variantId: v.id });
                              nav("/checkout", { state: { backgroundLocation: location } });
                            } else if (handleAdd(v, q, e)) {
                              trackFunnelEvent("buy_now", { productId: product.id, variantId: v.id });
                              nav("/checkout", { state: { backgroundLocation: location } });
                            }
                          }}
                          adminUrl={adminWhatsAppUrl}
                        />
                      );
                    })
                  )}
                </div>

              </section>
            </div>
          </div>

          <section className="pdx-variantsSection pdx-testimoniSection" aria-labelledby="pdx-testimoni-title">
            <div className="pdx-testimoniHead">
              <div className="pdx-testimoniCopy">
                <h2 id="pdx-testimoni-title" className="pdx-sectionTitle">Lihat Testimoni {product.name}</h2>
                <p className="pdx-testimoniDesc">
                  {productTestimonials.length > 0
                    ? `${productTestimonials.length} bukti transaksi ${product.name} dari pembeli. Klik foto untuk lihat full.`
                    : `Belum ada testimoni khusus ${product.name}. Kamu tetap bisa cek ulasan produk lainnya.`}
                </p>
              </div>
            </div>

            {productTestimonials.length > 0 ? (
              <div className="pdx-testimoniGrid">
                {productTestimonials.slice(0, 4).map((item, idx) => {
                  const dateLabel = formatTestimonialDate(item.purchased_at);
                  return (
                    <button
                      key={item.id || idx}
                      type="button"
                      className="pdx-testimoniThumb"
                      onClick={() => setPreviewTestimonialIdx(idx)}
                      aria-label={`Perbesar testimoni ${product.name} ${idx + 1}${dateLabel ? ` (${dateLabel})` : ""}`}
                    >
                      <img
                        src={item.image_url}
                        alt={`Testimoni ${product.name}${dateLabel ? ` · ${dateLabel}` : ""}`}
                        loading="lazy"
                        decoding="async"
                      />
                      <span className="pdx-testimoniThumbZoom" aria-hidden="true">
                        <ZoomIn size={15} />
                      </span>
                      {dateLabel ? <span className="pdx-testimoniThumbDate">{dateLabel}</span> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}

            <div className="pdx-testimoniFoot">
              <Link className="btn pdx-testimoniCta" to="/testimoni">
                <Images size={16} aria-hidden="true" />
                <span>Lihat Testimoni Semua Produk</span>
                <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            </div>
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

    {activeTestimonial && createPortal(
      <div
        className="reviews-backdrop"
        onMouseDown={(e) => { if (e.target === e.currentTarget) closeTestimonialViewer(); }}
      >
        <div
          ref={testimonialDialogRef}
          className="reviews-lightbox"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pdx-testimoni-viewer-title"
        >
          <div className="reviews-viewerHead">
            <div>
              <span className="reviews-eyebrow">TESTIMONI PRODUK</span>
              <h2 id="pdx-testimoni-viewer-title">
                {product.name} · {previewTestimonialIdx + 1} dari {productTestimonials.length}
              </h2>
            </div>
            <button
              className="reviews-iconButton"
              type="button"
              onClick={closeTestimonialViewer}
              aria-label="Tutup testimoni"
            >
              <X size={21} />
            </button>
          </div>
          <div className="reviews-viewerImage">
            <img
              src={activeTestimonial.image_url}
              alt={`Testimoni penuh ${product.name}`}
            />
          </div>
          <div className="reviews-viewerFoot">
            <div>
              <p>{product.name}</p>
              {formatTestimonialDate(activeTestimonial.purchased_at) ? (
                <span className="reviews-verifiedMeta">
                  Dibeli {formatTestimonialDate(activeTestimonial.purchased_at)}
                </span>
              ) : null}
            </div>
            {productTestimonials.length > 1 ? (
              <div className="reviews-viewerNav">
                <button
                  className="reviews-iconButton"
                  type="button"
                  onClick={() =>
                    setPreviewTestimonialIdx(
                      (i) => (i - 1 + productTestimonials.length) % productTestimonials.length
                    )
                  }
                  aria-label="Testimoni sebelumnya"
                >
                  <ChevronLeft size={22} />
                </button>
                <button
                  className="reviews-iconButton"
                  type="button"
                  onClick={() =>
                    setPreviewTestimonialIdx((i) => (i + 1) % productTestimonials.length)
                  }
                  aria-label="Testimoni berikutnya"
                >
                  <ChevronRight size={22} />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>,
      document.body
    )}
  </div>
  );
}
