import { useMemo, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Flame, Layers3, PackageCheck, ShoppingBag } from "lucide-react";
import { useTilt } from "../hooks/useTilt";
import { formatIDR, classifyStock, summarizeCatalogCopy, detectAccountTypes } from "../lib/format";
import "./ProductTile.css";

const FAVORITES_KEY = "imzaqi_favorites_v1";

function getFavorites() {
  try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]"); } catch { return []; }
}
function toggleFavorite(id) {
  const favs = getFavorites();
  const idx = favs.indexOf(id);
  if (idx >= 0) favs.splice(idx, 1); else favs.push(id);
  try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs)); } catch {}
  return idx < 0; // returns true if added
}

export default function ProductTile({ product, rank, layout = "list", disableTilt = false }) {
  const tiltRef = useTilt({ max: 6, scale: 1.008 });
  const isGrid = layout === "grid";
  const [isFav, setIsFav] = useState(() => getFavorites().includes(product?.id));
  const [heartFloats, setHeartFloats] = useState([]);
  const lastTapRef = useRef(0);

  const handleDoubleTap = useCallback((e) => {
    const now = Date.now();
    if (now - lastTapRef.current < 350) {
      e.preventDefault();
      e.stopPropagation();
      const added = toggleFavorite(product?.id);
      setIsFav(added);
      const id = `${now}_${Math.random().toString(16).slice(2)}`;
      setHeartFloats((prev) => [...prev.slice(-5), { id }]);
      setTimeout(() => setHeartFloats((prev) => prev.filter((f) => f.id !== id)), 900);
    }
    lastTapRef.current = now;
  }, [product?.id]);

  const summary = useMemo(() => {
    const activeVariants = (product?.product_variants || []).filter((v) => v?.is_active);
    const prices = activeVariants
      .map((v) => Number(v.price_idr || 0))
      .filter((n) => Number.isFinite(n) && n > 0);

    const stock = activeVariants.reduce((sum, item) => sum + Number(item?.stock || 0), 0);
    const sold = activeVariants.reduce((sum, item) => sum + Number(item?.sold_count || 0), 0);

    return {
      minPrice: prices.length ? Math.min(...prices) : 0,
      variantsCount: activeVariants.length,
      stock,
      sold,
      summaryCopy: summarizeCatalogCopy(product?.description),
    };
  }, [product]);

  const brandColor = useMemo(() => {
    const name = String(product?.name || "").toLowerCase();
    if (name.includes("netflix")) return "rgba(229, 9, 20, 0.4)";
    if (name.includes("canva")) return "rgba(0, 196, 204, 0.4)";
    if (name.includes("spotify")) return "rgba(29, 185, 84, 0.4)";
    if (name.includes("youtube")) return "rgba(255, 0, 0, 0.4)";
    if (name.includes("chatgpt")) return "rgba(16, 163, 127, 0.4)";
    if (name.includes("capcut")) return "rgba(0, 0, 0, 0.3)";
    if (name.includes("disney")) return "rgba(17, 60, 207, 0.4)";
    if (name.includes("prime")) return "rgba(0, 168, 225, 0.4)";
    return "rgba(255, 255, 255, 0.1)";
  }, [product?.name]);

  const stock = Number(summary.stock || 0);
  const sold = Number(summary.sold || 0);
  const displayPrice = summary.minPrice ? formatIDR(summary.minPrice) : "-";
  const accountTypes = useMemo(() => detectAccountTypes(product?.product_variants), [product]);

  const frontContent = (
    <>
      <div className="product-tile-top">
        <div
          className="product-tile-icon"
          aria-hidden="true"
          style={{ "--brand-color": brandColor }}
        >
          {product?.icon_url ? (
            <img
              src={product.icon_url}
              alt=""
              loading="lazy"
              decoding="async"
              fetchPriority="low"
              width="62"
              height="62"
            />
          ) : (
            <div className="product-tile-fallback">{String(product?.name || "P").slice(0, 1).toUpperCase()}</div>
          )}
        </div>

        <div className="product-tile-main">
          <div className="product-tile-name">
            {product?.name || "-"}
            {rank === 1 ? (
              <span className="product-tile-rankBadge product-tile-rankBadge--1">
                <Flame size={12} />
                <span>Terlaris</span>
              </span>
            ) : rank && rank <= 4 ? (
              <span className={`product-tile-rankBadge product-tile-rankBadge--${rank}`}>
                <span>#{rank}</span>
              </span>
            ) : null}
          </div>
          <div className="product-tile-desc">{summary.summaryCopy}</div>
        </div>

        <div className="product-tile-arrow" aria-hidden="true">
          <ArrowUpRight size={18} />
        </div>
      </div>

      <div className="product-tile-bottom" aria-label="Ringkasan produk">
        <div className="product-tile-pills" aria-label="Info singkat">
          <span className="product-tile-pill" title="Jumlah varian aktif">
            <Layers3 size={14} />
            <span>{summary.variantsCount || 0} varian</span>
          </span>
          <span className="product-tile-pill" title="Total stok aktif">
            <PackageCheck size={14} />
            <span>{stock} stok</span>
          </span>
          <span className="product-tile-pill home-popularSold" title={`${sold} terjual`}>
            <ShoppingBag size={14} />
            <span>{sold} terjual</span>
          </span>
          {accountTypes.map((t) => (
            <span key={t.label} className="product-typeBadge" style={{ "--type-color": t.color }}>
              {t.label}
            </span>
          ))}
          <span className="product-tile-pill home-deliveryPill" title="Estimasi pengiriman">
            <span>5 Menit</span>
          </span>
          {classifyStock(stock) === "low" ? (
            <span className="product-lowStockBadge">Hampir habis</span>
          ) : classifyStock(stock) === "out" ? (
            <span className="product-lowStockBadge out">Habis</span>
          ) : null}
        </div>

        <div className="product-tile-price" aria-label="Harga mulai">
          {displayPrice}
        </div>
      </div>
    </>
  );

  return (
    <Link
      to={`/produk/${product.slug}`}
      className={`product-tile product-tile--${isGrid ? "grid" : "list"}${isGrid ? " product-tile--flippable" : ""}${isFav ? " is-fav" : ""}`}
      role="listitem"
      aria-label={`Buka detail ${product?.name || "produk"}`}
      onClick={handleDoubleTap}
      style={{ position: "relative" }}
    >
      {heartFloats.map((f) => (
        <span key={f.id} className="product-tile-heartFloat" aria-hidden="true">❤️</span>
      ))}
      {isFav ? <span className="product-tile-favBadge" aria-label="Favorit" aria-hidden="true">❤️</span> : null}
      <div ref={disableTilt ? null : tiltRef} className="product-tile-tiltWrap">
        {isGrid ? (
          <>
            {/* Front face */}
            <div className="product-tile-face product-tile-front">
              {frontContent}
            </div>
            {/* Back face */}
            <div className="product-tile-face product-tile-back" aria-hidden="true">
              <div className="product-tile-back-inner">
                <div className="product-tile-back-icon" style={{ "--brand-color": brandColor }}>
                  {product?.icon_url ? (
                    <img src={product.icon_url} alt="" loading="lazy" width="48" height="48" />
                  ) : (
                    <div className="product-tile-fallback">{String(product?.name || "P").slice(0, 1).toUpperCase()}</div>
                  )}
                </div>
                <div className="product-tile-back-name">{product?.name}</div>
                <div className="product-tile-back-price">{displayPrice}</div>
                <div className="product-tile-back-stats">
                  <span><PackageCheck size={12} />&nbsp;{stock} stok</span>
                  <span><ShoppingBag size={12} />&nbsp;{sold} terjual</span>
                </div>
                <div className="product-tile-back-cta">Lihat detail →</div>
              </div>
            </div>
          </>
        ) : (
          frontContent
        )}
      </div>
    </Link>
  );
}
