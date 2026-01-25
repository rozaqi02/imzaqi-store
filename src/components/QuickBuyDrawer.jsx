import React, { useMemo } from "react";
import { formatIDR } from "../lib/format";
import { useCart } from "../context/CartContext";
import { Link } from "react-router-dom";

export default function QuickBuyDrawer({ open, onClose, product }) {
  const cart = useCart();

  const variants = useMemo(() => {
    const v = (product?.product_variants || []).slice();
    v.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    return v;
  }, [product]);

  if (!open) return null;

  return (
    <div className="drawer-backdrop" onMouseDown={onClose} role="presentation">
      <div className="drawer" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="drawer-head">
          <div>
            <div className="drawer-title">{product?.name || "Pilih paket"}</div>
            <div className="drawer-sub">Klik varian untuk tambah ke keranjang.</div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Tutup">✕</button>
        </div>

        <div className="drawer-body">
          {variants.map((v) => (
            <button
              key={v.id}
              className="drawer-item"
              onClick={() =>
                cart.add({ ...v, product_id: product.id, product_name: product.name }, 1)
              }
            >
              <div className="drawer-item-left">
                <div className="drawer-item-name">{v.name}</div>
                <div className="drawer-item-sub">
                  {v.duration_label}{v.guarantee_text ? ` • ${v.guarantee_text}` : ""}
                </div>
              </div>
              <div className="drawer-item-right">
                <b>{formatIDR(v.price_idr)}</b>
                <span className="mini">+ keranjang</span>
              </div>
            </button>
          ))}
        </div>

        <div className="drawer-foot">
          <Link className="btn btn-wide" to="/checkout" onClick={onClose}>Lanjut Checkout</Link>
          <button className="btn btn-ghost btn-wide" onClick={() => cart.clear()}>Kosongkan Keranjang</button>
        </div>
      </div>
    </div>
  );
}
