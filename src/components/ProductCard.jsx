import React, { useMemo } from "react";
import { formatIDR } from "../lib/format";
import { useCart } from "../context/CartContext";

export default function ProductCard({ product }) {
  const { add } = useCart();

  const variants = useMemo(() => (product?.product_variants || []).slice().sort((a,b) => (a.sort_order||0)-(b.sort_order||0)), [product]);

  return (
    <div className="product-card">
      <div className="product-head">
        <div className="product-title">
          <div className="product-name">{product.name}</div>
          <div className="product-desc">{product.description}</div>
        </div>
        <div className="product-badge">Full Garansi*</div>
      </div>

      <div className="variant-list">
        {variants.map(v => (
          <div key={v.id} className="variant-row">
            <div className="variant-meta">
              <div className="variant-name">{v.name}</div>
              <div className="variant-sub">{v.duration_label}{v.guarantee_text ? ` • ${v.guarantee_text}` : ""}</div>
            </div>
            <div className="variant-right">
              <div className="variant-price">{formatIDR(v.price_idr)}</div>
              <button
                className="btn btn-sm"
                onClick={() => add({
                  ...v,
                  product_id: product.id,
                  product_name: product.name,
                }, 1)}
              >
                + Keranjang
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
