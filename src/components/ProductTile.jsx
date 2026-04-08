import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Layers3, PackageCheck, ShoppingBag } from "lucide-react";
import { formatIDR } from "../lib/format";

function summarizeCatalogCopy(text) {
  const firstLine = String(text || "")
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) return "Pilih paket lalu lanjut ke checkout.";
  return firstLine.length > 58 ? `${firstLine.slice(0, 55).trimEnd()}...` : firstLine;
}

export default function ProductTile({ product }) {
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

  const stock = Number(summary.stock || 0);
  const sold = Number(summary.sold || 0);
  const displayPrice = summary.minPrice ? formatIDR(summary.minPrice) : "-";

  return (
    <Link
      to={`/produk/${product.slug}`}
      className="product-tile product-tile--list"
      role="listitem"
      aria-label={`Buka detail ${product?.name || "produk"}`}
    >
      <div className="product-tile-top">
        <div className="product-tile-icon" aria-hidden="true">
          {product?.icon_url ? (
            <img src={product.icon_url} alt="" loading="lazy" decoding="async" />
          ) : (
            <div className="product-tile-fallback">{String(product?.name || "P").slice(0, 1).toUpperCase()}</div>
          )}
        </div>

        <div className="product-tile-main">
          <div className="product-tile-name">{product?.name || "-"}</div>
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
        </div>

        <div className="product-tile-price" aria-label="Harga mulai">
          {displayPrice}
        </div>
      </div>
    </Link>
  );
}
