import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Megaphone, ShieldCheck, Sparkles, Tag, X, Zap } from "lucide-react";
import { fetchActiveFlashSales, fetchProducts, fetchPromoCodes, fetchSettings } from "../lib/api";
import { copyToClipboard } from "../utils/clipboard";
import { isKnownOutOfStock, isPromoExpired } from "../lib/format";
import { normalizePromotion, resolveBannerCopy } from "../lib/storefrontPromotions";
import BannerGraphic from "./BannerGraphic";

function BannerIcon({ name }) {
  if (!name || name === "none") return null;
  switch (name) {
    case "bell":
      return <Bell size={13} className="promo-tickerGlyph" aria-hidden="true" />;
    case "megaphone":
      return <Megaphone size={13} className="promo-tickerGlyph" aria-hidden="true" />;
    case "zap":
      return <Zap size={13} className="promo-tickerGlyph" aria-hidden="true" />;
    case "sparkles":
      return <Sparkles size={13} className="promo-tickerGlyph" aria-hidden="true" />;
    case "shield":
      return <ShieldCheck size={13} className="promo-tickerGlyph" aria-hidden="true" />;
    case "tag":
      return <Tag size={13} className="promo-tickerGlyph" aria-hidden="true" />;
    default:
      return null;
  }
}

const FLASH_ROTATE_MS = 6000;
const PROMO_DISMISS_KEY = "imzaqi_ticker_promo_dismissed";
const FLASH_DISMISS_KEY = "imzaqi_ticker_flash_dismissed";
const NEW_PRODUCT_DISMISS_KEY = "imzaqi_ticker_new_product_dismissed";
const SERVICE_DISMISS_KEY = "imzaqi_ticker_service_dismissed";

function isPromoLive(promo) {
  if (!promo?.is_active) return false;
  if (isPromoExpired(promo)) return false;
  if (promo.max_uses != null && Number(promo.used_count || 0) >= Number(promo.max_uses)) return false;
  return true;
}

function buildFlashItems(sales, products) {
  const byProduct = new Map();

  (sales || []).forEach((sale) => {
    const discount = Number(sale?.discount_percent || 0);
    if (discount <= 0) return;

    (products || []).forEach((product) => {
      const variant = (product?.product_variants || []).find((item) => item.id === sale.variant_id);
      if (!variant || variant.is_active === false || isKnownOutOfStock(variant)) return;

      const slug = product.slug || product.id;
      const current = byProduct.get(slug);
      if (current && current.discount >= discount) return;

      const duration = String(variant.duration_label || "").trim();

      byProduct.set(slug, {
        key: slug,
        name: product.name,
        duration,
        to: product.slug ? `/produk/${product.slug}` : "/produk",
        discount,
      });
    });
  });

  return [...byProduct.values()].sort((a, b) => b.discount - a.discount);
}

function pickHomePromo(promos, allowedCodes) {
  const allowed = Array.isArray(allowedCodes) ? allowedCodes : [];
  if (!allowed.length) return null;

  const live = (promos || []).filter(isPromoLive);
  for (const code of allowed) {
    const match = live.find((promo) => promo.code === code);
    if (match) return match;
  }
  return null;
}

export default function PromoTicker() {
  const [flashItems, setFlashItems] = useState([]);
  const [flashIndex, setFlashIndex] = useState(0);
  const [promo, setPromo] = useState(null);
  const [bannerConfig, setBannerConfig] = useState(null);
  const [serviceBannerConfig, setServiceBannerConfig] = useState(null);
  const [bannerProducts, setBannerProducts] = useState([]);
  const [bannerSales, setBannerSales] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [flashDismissed, setFlashDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(FLASH_DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [serviceDismissed, setServiceDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(SERVICE_DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [promoDismissed, setPromoDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(PROMO_DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [newProductDismissed, setNewProductDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(NEW_PRODUCT_DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;

    Promise.all([
      fetchActiveFlashSales({ useCache: true }).catch(() => []),
      fetchProducts({ includeInactive: false, useCache: true }).catch(() => []),
      fetchPromoCodes().catch(() => []),
      fetchSettings({ useCache: true }).catch(() => ({})),
    ]).then(([sales, products, promos, settings]) => {
      if (!alive) return;
      setFlashItems(buildFlashItems(sales, products));
      setPromo(pickHomePromo(promos, settings?.home_promos?.codes));
      setBannerConfig(normalizePromotion("new_product_banner", settings?.new_product_banner));
      setServiceBannerConfig(normalizePromotion("service_banner", settings?.service_banner));
      setBannerProducts(products);
      setBannerSales(sales);
    });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (flashItems.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setFlashIndex((index) => (index + 1) % flashItems.length);
    }, FLASH_ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [flashItems.length]);

  const flash = flashItems[flashIndex];
  const showPromo = Boolean(promo) && !promoDismissed;
  const bannerCopy = bannerConfig ? resolveBannerCopy(bannerConfig, bannerProducts, bannerSales, now) : null;
  const showBanner = Boolean(bannerConfig?.enabled && bannerCopy?.available) && !newProductDismissed;
  const showFlash = Boolean(flash) && !flashDismissed && !(showBanner && bannerConfig?.type === "flash");
  const showService = Boolean(serviceBannerConfig?.enabled) && !serviceDismissed;
  const bannerLabel = { product: "Produk baru", flash: "Flash sale pilihan", academic: "Jasa akademik", custom: "Pengumuman toko" }[bannerConfig?.type] || "Pengumuman toko";

  function dismissFlash() {
    try {
      sessionStorage.setItem(FLASH_DISMISS_KEY, "1");
    } catch {}
    setFlashDismissed(true);
  }

  function dismissService(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    try {
      sessionStorage.setItem(SERVICE_DISMISS_KEY, "1");
    } catch {}
    setServiceDismissed(true);
  }

  function dismissPromo(event) {
    event.preventDefault();
    event.stopPropagation();
    try {
      sessionStorage.setItem(PROMO_DISMISS_KEY, "1");
    } catch {}
    setPromoDismissed(true);
  }

  function dismissNewProduct(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    try {
      sessionStorage.setItem(NEW_PRODUCT_DISMISS_KEY, "1");
    } catch {}
    setNewProductDismissed(true);
  }

  async function copyPromo() {
    if (!promo?.code) return;
    try {
      await copyToClipboard(promo.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  const flashLabel = flash ? (flash.duration ? `${flash.name} · ${flash.duration}` : flash.name) : "";

  return (
    <div className="promo-tickerStack">
      {showBanner ? (
        <div
          className={`promo-ticker promo-ticker--newProduct promo-ticker--color-${bannerConfig.color || "orange"} promo-ticker--style-${bannerConfig.banner_style || "minimal_border"}`}
          role="region"
          aria-label={bannerLabel}
        >
          <p className="promo-tickerItem">
            <BannerIcon name={bannerConfig.icon} />
            {bannerCopy.badge ? (
              <span className="promo-tickerBadge">{bannerCopy.badge}</span>
            ) : null}
            {/^https?:\/\//i.test(bannerCopy.link)
              ? <a className={`promo-tickerLink promo-tickerLink--${bannerConfig.link_style || "underline"}`} href={bannerCopy.link}>{bannerCopy.text}</a>
              : <Link className={`promo-tickerLink promo-tickerLink--${bannerConfig.link_style || "underline"}`} to={bannerCopy.link}>{bannerCopy.text}</Link>}
            <BannerGraphic name={bannerConfig.graphic || "bell_megaphone"} height={22} />
          </p>
          <button
            type="button"
            className="promo-tickerClose"
            aria-label={`Tutup banner ${bannerLabel.toLowerCase()}`}
            onClick={dismissNewProduct}
          >
            <X size={15} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {showFlash ? (
        <div className="promo-ticker promo-ticker--flash" role="region" aria-label="Flash sale">
          <p className="promo-tickerItem">
            <BannerGraphic name="flash_lightning" height={20} />
            Flash sale{" "}
            <Link className="promo-tickerLink promo-tickerLink--underline" to={flash.to}>
              {flashLabel}
            </Link>
            {` · -${flash.discount}%`}
          </p>
          <button type="button" className="promo-tickerClose promo-tickerClose--flash" aria-label="Tutup banner flash sale" onClick={dismissFlash}>
            <X size={15} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {showService ? (
        <div
          className={`promo-ticker promo-ticker--service promo-ticker--color-${serviceBannerConfig.color || "green"} promo-ticker--style-${serviceBannerConfig.banner_style || "minimal_border"}`}
          role="region"
          aria-label="Info layanan"
        >
          <p className="promo-tickerItem">
            <BannerIcon name={serviceBannerConfig.icon} />
            {serviceBannerConfig.badge ? (
              <span className="promo-tickerBadge">{serviceBannerConfig.badge}</span>
            ) : null}
            {/^https?:\/\//i.test(serviceBannerConfig.link) ? (
              <a className={`promo-tickerLink promo-tickerLink--${serviceBannerConfig.link_style || "underline"}`} href={serviceBannerConfig.link}>
                {serviceBannerConfig.text}
              </a>
            ) : (
              <Link className={`promo-tickerLink promo-tickerLink--${serviceBannerConfig.link_style || "underline"}`} to={serviceBannerConfig.link || "/produk"}>
                {serviceBannerConfig.text}
              </Link>
            )}
            <BannerGraphic name={serviceBannerConfig.graphic || "shield_star"} height={22} />
          </p>
          <button
            type="button"
            className="promo-tickerClose promo-tickerClose--flash"
            aria-label="Tutup banner info layanan"
            onClick={dismissService}
          >
            <X size={15} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {showPromo ? (
        <div className={`promo-ticker promo-ticker--code${(flashItems.length || showService || showBanner) ? " promo-ticker--mobileStack" : ""}`} role="region" aria-label="Kode promo">
          <p className="promo-tickerItem">
            Kode promo{" "}
            <button
              type="button"
              className="promo-tickerLink promo-tickerCode"
              onClick={copyPromo}
              aria-label={copied ? `Kode ${promo.code} tersalin` : `Salin kode promo ${promo.code}`}
            >
              {promo.code}
            </button>
            {copied ? " tersalin" : ` · ${promo.percent}%`}
          </p>
          <button type="button" className="promo-tickerClose" aria-label="Tutup kode promo" onClick={dismissPromo}>
            <X size={15} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
