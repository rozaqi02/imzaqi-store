import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Trash2, X } from "lucide-react";
import { useCart } from "../context/CartContext";
import { formatIDR } from "../lib/format";
const PREVIEW_LIMIT = 5;

export default function MobileCartSheet({ open, onClose }) {
  const location = useLocation();
  const cart = useCart();
  const items = cart?.items || [];
  const cartCount = items.reduce((sum, item) => sum + Number(item?.qty || 0), 0);
  const totalPrice = items.reduce((sum, item) => sum + Number(item?.price_idr || 0) * Number(item?.qty || 0), 0);
  const hiddenCount = Math.max(0, items.length - PREVIEW_LIMIT);

  if (!open || typeof document === "undefined") return null;

  function handleRemove(variantId) {
    cart.remove(variantId);
  }

  return createPortal(
    <>
      <div className="mini-cart-sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="mini-cart-sheet" role="dialog" aria-modal="true" aria-label="Keranjang">
        <div className="mini-cart-sheet-head">
          <h4>Keranjang ({cartCount})</h4>
          <button type="button" className="mini-cart-sheet-close" aria-label="Tutup" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="mini-cart-empty">
            <p>Keranjang kosong</p>
            <Link className="btn btn-sm" to="/produk" onClick={onClose}>
              Lihat katalog
            </Link>
          </div>
        ) : (
          <>
            <div className="mini-cart-items">
              {items.slice(0, PREVIEW_LIMIT).map((item) => (
                <div key={item.variant_id} className="mini-cart-item">
                  <div className="mini-cart-item-details">
                    <div className="mini-cart-item-title">{item.product_name}</div>
                    <div className="mini-cart-item-subtitle">
                      {item.variant_name} × {item.qty}
                    </div>
                  </div>
                  <strong>{formatIDR(Number(item.price_idr || 0) * Number(item.qty || 0))}</strong>
                  <button
                    type="button"
                    className="mini-cart-item-remove"
                    aria-label={`Hapus ${item.product_name}`}
                    onClick={() => handleRemove(item.variant_id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {hiddenCount > 0 ? (
                <Link
                  className="mini-cart-more-link"
                  to="/checkout"
                  state={{ backgroundLocation: location }}
                  onClick={onClose}
                >
                  +{hiddenCount} item lainnya
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              ) : null}
            </div>
            <div className="mini-cart-footer">
              <div className="mini-cart-total">
                <span>Subtotal</span>
                <strong>{formatIDR(totalPrice)}</strong>
              </div>
              <Link
                to="/checkout"
                state={{ backgroundLocation: location }}
                className="btn btn-wide"
                onClick={onClose}
              >
                Buka Checkout
              </Link>
            </div>
          </>
        )}
      </div>
    </>,
    document.body
  );
}