import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Layers3, PackageCheck } from "lucide-react";
import { formatIDR } from "../lib/format";

export default function ProductTile({ product }) {
  const summary = useMemo(() => {
    const activeVariants = (product?.product_variants || []).filter((v) => v?.is_active);
    const prices = activeVariants
      .map((v) => Number(v.price_idr || 0))
      .filter((n) => Number.isFinite(n) && n > 0);
    const totalStock = activeVariants.reduce((sum, item) => sum + Number(item?.stock || 0), 0);

    return {
      minPrice: prices.length ? Math.min(...prices) : null,
      variantsCount: activeVariants.length,
      totalStock,
    };
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
          <div className="product-tile-desc">
            {product.description || "Pilih paket dan checkout."}
          </div>
        </div>

        <span className="product-tile-arrow">
          <ArrowUpRight size={18} />
        </span>
      </div>

      <div className="product-tile-bottom">
        <div className="product-tile-pills">
          <span className="product-tile-pill">
            <Layers3 size={13} />
            <span>{summary.variantsCount || 0}</span>
          </span>
          <span className="product-tile-pill">
            <PackageCheck size={13} />
            <span>{summary.totalStock || 0}</span>
          </span>
        </div>

        <div className="product-tile-price">
          {summary.minPrice ? formatIDR(summary.minPrice) : "Lihat paket"}
        </div>
      </div>
    </Link>
  );
}
