import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Zap } from "lucide-react";
import { fetchActiveFlashSales, fetchProducts } from "../lib/api";
import { formatIDR } from "../lib/format";

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

  return { hours, minutes, seconds, expired: diff <= 0 };
}

function CountdownDisplay({ endTime }) {
  const { hours, minutes, seconds, expired } = useCountdown(endTime);

  if (expired) return <span className="flash-countdown-expired">Berakhir</span>;

  return (
    <div className="flash-countdown">
      <span className="flash-countdown-icon">⏱</span>
      <span className="flash-countdown-num">{String(hours).padStart(2, "0")}</span>
      <span className="flash-countdown-sep">:</span>
      <span className="flash-countdown-num">{String(minutes).padStart(2, "0")}</span>
      <span className="flash-countdown-sep">:</span>
      <span className="flash-countdown-num">{String(seconds).padStart(2, "0")}</span>
    </div>
  );
}

export default function FlashSaleBanner() {
  const [flashSales, setFlashSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [sales, prods] = await Promise.all([
          fetchActiveFlashSales(),
          fetchProducts({ useCache: true }),
        ]);
        if (!alive) return;
        setFlashSales(sales);
        setProducts(prods);
      } catch (e) {
        console.warn("Flash sale load failed:", e);
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

    const result = [];
    products.forEach((product) => {
      (product.product_variants || []).forEach((variant) => {
        const sale = flashMap.get(variant.id);
        if (!sale) return;
        if (!variant.is_active) return;

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

  // Get the latest end time for the countdown
  const latestEndTime = useMemo(() => {
    if (!flashSales.length) return null;
    return flashSales.reduce((latest, sale) => {
      const t = new Date(sale.ends_at).getTime();
      return t > latest ? t : latest;
    }, 0);
  }, [flashSales]);

  if (loading || items.length === 0) return null;

  return (
    <section className="flash-sale-banner">
      <div className="flash-sale-header">
        <div className="flash-sale-title">
          <Zap size={16} />
          <span>Flash Sale</span>
        </div>
        {latestEndTime ? <CountdownDisplay endTime={new Date(latestEndTime).toISOString()} /> : null}
      </div>

      <div className="flash-sale-scroll">
        {items.map((item) => (
          <Link
            key={item.id}
            to={`/produk/${item.product.slug}`}
            className="flash-sale-card"
          >
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
          </Link>
        ))}
      </div>
    </section>
  );
}
