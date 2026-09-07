import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Zap } from "lucide-react";
import { useTilt } from "../hooks/useTilt";
import { fetchActiveFlashSales, fetchProducts } from "../lib/api";
import { warn } from "../lib/log";
import { formatIDR, isKnownOutOfStock } from "../lib/format";

function FlashSaleCard({ item, maxFlashStock }) {
  const tiltRef = useTilt({ max: 8, scale: 1.012 });

  return (
    <Link to={`/produk/${item.product.slug}`} className="flash-sale-card">
      <div ref={tiltRef} className="flash-sale-cardInner">
        <div className="flash-sale-badge">-{item.discountPercent}%</div>

        <div className="flash-sale-icon">
          {item.product.icon_url ? (
            <img src={item.product.icon_url} alt="" loading="lazy" decoding="async" width="48" height="48" />
          ) : (
            <div className="flash-sale-icon-fallback">
              {String(item.product.name || "P").slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>

        <div className="flash-sale-name">{item.product.name}</div>

        <div className="flash-sale-prices">
          <span className="flash-sale-original">{formatIDR(item.originalPrice)}</span>
          <span className="flash-sale-discounted">{formatIDR(item.discountedPrice)}</span>
        </div>

        <div className="flash-sale-meta">
          {item.stock > 0 ? `Stok ${item.stock}` : "Habis"}
        </div>

        {item.stock > 0 ? (
          <div className="flash-sale-stockBar" aria-hidden="true">
            <span style={{ width: `${Math.min(100, (item.stock / maxFlashStock) * 100)}%` }} />
          </div>
        ) : null}
      </div>
    </Link>
  );
}

function useCountdown(endTime) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const end = new Date(endTime).getTime();
  const diff = Math.max(0, end - now);
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  const totalSeconds = Math.floor(diff / 1000);

  return { hours, minutes, seconds, expired: diff <= 0, now, totalSeconds };
}

function CountdownDisplay({ endTime, startTime }) {
  const { hours, minutes, seconds, expired, now } = useCountdown(endTime);

  const progressPct = useMemo(() => {
    if (!startTime || !endTime) return 0;
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const span = end - start;
    if (!Number.isFinite(span) || span <= 0) return 0;
    const remaining = Math.max(0, end - now);
    return Math.min(100, Math.max(0, ((span - remaining) / span) * 100));
  }, [endTime, startTime, now]);

  if (expired) return <span className="flash-countdown-expired">Berakhir</span>;

  const units = [
    { key: "h", value: hours, label: "jam" },
    { key: "m", value: minutes, label: "menit" },
    { key: "s", value: seconds, label: "detik", sec: true },
  ];

  return (
    <div className="flash-countdown-wrap">
      <div className="flash-countdown" aria-label={`Sisa ${hours} jam ${minutes} menit ${seconds} detik`}>
        <span className="flash-countdown-icon" aria-hidden="true">
          ⏱
        </span>
        {units.map((unit, idx) => (
          <React.Fragment key={unit.key}>
            {idx > 0 ? <span className="flash-countdown-sep" aria-hidden="true">:</span> : null}
            <span className={`flash-countdown-unit${unit.sec ? " is-sec" : ""}`}>
              <span className="flash-countdown-num">{String(unit.value).padStart(2, "0")}</span>
              <span className="flash-countdown-label">{unit.label}</span>
            </span>
          </React.Fragment>
        ))}
      </div>
      <div className="flash-sale-progress" aria-hidden="true">
        <div className="flash-sale-progressFill" style={{ width: `${progressPct}%` }} />
      </div>
    </div>
  );
}

let cachedFlashSales = null;
let cachedFlashProducts = null;
let cachedFlashAt = 0;
const FLASH_CACHE_TTL_MS = 60_000;

export default function FlashSaleBanner() {
  const [flashSales, setFlashSales] = useState(cachedFlashSales || []);
  const [products, setProducts] = useState(cachedFlashProducts || []);
  const [loading, setLoading] = useState(!cachedFlashSales || !cachedFlashProducts || Date.now() - cachedFlashAt > FLASH_CACHE_TTL_MS);

  useEffect(() => {
    if (cachedFlashSales && cachedFlashProducts && Date.now() - cachedFlashAt < FLASH_CACHE_TTL_MS) return;

    let alive = true;
    (async () => {
      try {
        const [sales, prods] = await Promise.all([
          fetchActiveFlashSales(),
          fetchProducts({ useCache: true }),
        ]);
        if (!alive) return;
        cachedFlashSales = sales;
        cachedFlashProducts = prods;
        cachedFlashAt = Date.now();
        setFlashSales(sales);
        setProducts(prods);
      } catch (e) {
        warn("Flash sale load failed:", e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Map variant_id → flash sale info
  const flashMap = useMemo(() => {
    const map = new Map();
    flashSales.forEach((sale) => {
      map.set(sale.variant_id, sale);
    });
    return map;
  }, [flashSales]);

  // Build display items: variant + product info + flash sale discount
  const items = useMemo(() => {
    if (!flashSales.length || !products.length) return [];

    const now = Date.now();
    const result = [];
    products.forEach((product) => {
      (product.product_variants || []).forEach((variant) => {
        const sale = flashMap.get(variant.id);
        if (!sale) return;
        if (!variant.is_active) return;
        if (isKnownOutOfStock(variant) || Number(variant.stock || 0) <= 0) return;

        if (sale.ends_at) {
          const end = new Date(sale.ends_at).getTime();
          if (Number.isFinite(end) && end <= now) return;
        }
        if (sale.starts_at) {
          const start = new Date(sale.starts_at).getTime();
          if (Number.isFinite(start) && start > now) return;
        }

        const originalPrice = Number(variant.price_idr || 0);
        const discountedPrice = Math.round(originalPrice * (1 - sale.discount_percent / 100));

        result.push({
          id: sale.id,
          product,
          variant,
          discountPercent: sale.discount_percent,
          originalPrice,
          discountedPrice,
          endsAt: sale.ends_at,
          stock: Number(variant.stock || 0),
        });
      });
    });

    return result;
  }, [flashSales, products, flashMap]);

  const countdownWindow = useMemo(() => {
    if (!items.length) return null;
    let earliestStart = Infinity;
    let latestEnd = 0;
    items.forEach((item) => {
      const sale = flashMap.get(item.variant.id);
      if (!sale) return;
      const start = new Date(sale.starts_at || sale.created_at || sale.ends_at).getTime();
      const end = new Date(sale.ends_at).getTime();
      if (Number.isFinite(start) && start < earliestStart) earliestStart = start;
      if (Number.isFinite(end) && end > latestEnd) latestEnd = end;
    });
    if (!Number.isFinite(earliestStart)) earliestStart = Date.now();
    if (latestEnd <= Date.now()) return null;
    return {
      startTime: new Date(earliestStart).toISOString(),
      endTime: new Date(latestEnd).toISOString(),
    };
  }, [items, flashMap]);

  const bannerCountdown = useCountdown(countdownWindow?.endTime);
  const isUrgent = Boolean(countdownWindow && !bannerCountdown.expired && bannerCountdown.totalSeconds <= 10);

  const maxFlashStock = useMemo(
    () => Math.max(1, ...items.map((item) => item.stock)),
    [items]
  );

  if (loading || items.length === 0 || !countdownWindow || bannerCountdown.expired) return null;

  return (
    <section className={`flash-sale-banner${isUrgent ? " is-urgent" : ""}`}>
      <div className="flash-sale-header">
        <div className="flash-sale-title">
          <Zap size={16} />
          <span>Flash Sale</span>
        </div>
        {countdownWindow ? (
          <CountdownDisplay endTime={countdownWindow.endTime} startTime={countdownWindow.startTime} />
        ) : null}
      </div>

      <div className="flash-sale-scroll">
        {items.map((item) => (
          <FlashSaleCard key={item.id} item={item} maxFlashStock={maxFlashStock} />
        ))}
      </div>
    </section>
  );
}
