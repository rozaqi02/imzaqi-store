import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { formatIDR } from "../lib/format";

export default function ProductTile({ product }) {
  const minPrice = useMemo(() => {
    const prices = (product?.product_variants || [])
      .filter((v) => v?.is_active)
      .map((v) => Number(v.price_idr || 0))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (prices.length === 0) return null;
    return Math.min(...prices);
  }, [product]);

  return (
    <Link to={`/produk/${product.slug}`} className="product-tile">
      <div className="product-tile-top">
        <div className="product-tile-icon">
          {product.icon_url ? (
            <img src={product.icon_url} alt={product.name} />
          ) : (
            <span className="product-tile-fallback">{String(product.name || "P").slice(0, 1).toUpperCase()}</span>
          )}
        </div>

        <div className="product-tile-main">
          <div className="product-tile-name">{product.name}</div>
          {product.description ? <div className="product-tile-desc">{product.description}</div> : null}
        </div>
      </div>

      <div className="product-tile-bottom">
        <div className="product-tile-meta">{minPrice ? `Mulai dari ${formatIDR(minPrice)}` : "Lihat paket"}</div>
        <div className="product-tile-cta">Detail →</div>
      </div>
    </Link>
  );
}
