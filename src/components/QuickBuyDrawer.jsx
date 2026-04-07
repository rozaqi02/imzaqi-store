import React, { useMemo } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { formatIDR } from "../lib/format";
import { useCart } from "../context/CartContext";

export default function QuickBuyDrawer({ open, onClose, product }) {
  const cart = useCart();
  const location = useLocation();

  const variants = useMemo(() => {
    const list = (product?.product_variants || []).slice();
    list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    return list;
  }, [product]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="drawer-backdrop" onMouseDown={onClose} role="presentation">
      <div className="drawer" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="drawer-head">
          <div>
            <div className="drawer-title">{product?.name || "Pilih paket"}</div>
            <div className="drawer-sub">Klik varian untuk tambah ke keranjang.</div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Tutup" type="button">
            X
          </button>
        </div>

        <div className="drawer-body">
          {variants.map((variant) => (
            <button
              key={variant.id}
              className="drawer-item"
              type="button"
              onClick={() =>
                cart.add(
                  {
                    ...variant,
                    product_id: product.id,
                    product_name: product.name,
                    product_icon_url: product?.icon_url || "",
                  },
                  1
                )
              }
            >
              <div className="drawer-item-left">
                <div className="drawer-item-name">{variant.name}</div>
                <div className="drawer-item-sub">
                  {variant.duration_label}
                  {variant.guarantee_text ? ` - ${variant.guarantee_text}` : ""}
                </div>
              </div>
              <div className="drawer-item-right">
                <b>{formatIDR(variant.price_idr)}</b>
                <span className="mini">+ keranjang</span>
              </div>
            </button>
          ))}
        </div>

        <div className="drawer-foot">
          <Link className="btn btn-wide" to="/checkout" state={{ backgroundLocation: location }} onClick={onClose}>
            Lanjut Checkout
          </Link>
          <button className="btn btn-ghost btn-wide" onClick={() => cart.clear()} type="button">
            Kosongkan Keranjang
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
