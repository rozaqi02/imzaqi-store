import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { fetchActiveFlashSales, fetchProducts, fetchPromoCodes, fetchSettings } from "../lib/api";
import { copyToClipboard } from "../utils/clipboard";
import { isKnownOutOfStock, isPromoExpired } from "../lib/format";

const FLASH_ROTATE_MS = 6000;
const PROMO_DISMISS_KEY = "imzaqi_ticker_promo_dismissed";

const DEFAULT_FLASH = {
  name: "",
  duration: "",
  discount: 0,
  to: "/produk",
};

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
  const [promoDismissed, setPromoDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(PROMO_DISMISS_KEY) === "1";
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
    });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (flashItems.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setFlashIndex((index) => (index + 1) % flashItems.length);
    }, FLASH_ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [flashItems.length]);

  const flash = flashItems[flashIndex] || DEFAULT_FLASH;
  const showPromo = Boolean(promo) && !promoDismissed;

  function dismissPromo(event) {
    event.preventDefault();
    event.stopPropagation();
    try {
      sessionStorage.setItem(PROMO_DISMISS_KEY, "1");
    } catch {}
    setPromoDismissed(true);
  }

  async function copyPromo() {
    if (!promo?.code) return;
    try {
      await copyToClipboard(promo.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  const flashLabel = flash.duration ? `${flash.name} · ${flash.duration}` : flash.name;

  return (
    <div className="promo-tickerStack">
      <div className="promo-ticker promo-ticker--flash" role="region" aria-label="Flash sale">
        <p className="promo-tickerItem">
          {flash.name ? (
            <>
              Flash sale{" "}
              <Link className="promo-tickerLink" to={flash.to}>
                {flashLabel}
              </Link>
              {` · -${flash.discount}%`}
            </>
          ) : (
            <Link className="promo-tickerLink" to={DEFAULT_FLASH.to}>
              Proses 5–30 menit · Garansi replace · Checkout QRIS
            </Link>
          )}
        </p>
      </div>

      {showPromo ? (
        <div className="promo-ticker promo-ticker--code" role="region" aria-label="Kode promo">
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
            <X size={12} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
