import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ShoppingCart, X } from "lucide-react";
import { useCart } from "../context/CartContext";
import { shouldShowAbandonedCartReminder, dismissAbandonedCartReminder } from "../lib/cartReminder";
import { useFunnelRoute } from "../hooks/useFunnelRoute";
import "./AbandonedCartBanner.css";

export default function AbandonedCartBanner() {
  const location = useLocation();
  const isFunnel = useFunnelRoute();
  const cart = useCart();
  const [dismissed, setDismissed] = useState(false);
  const count = (cart?.items || []).reduce((sum, item) => sum + Number(item?.qty || 0), 0);

  if (dismissed || isFunnel || !shouldShowAbandonedCartReminder(count)) return null;

  return (
    <div className="abandoned-cart-banner" role="status">
      <ShoppingCart size={16} />
      <div className="abandoned-cart-copy">
        <strong>Masih ada {count} item di keranjang</strong>
        <span>Lanjut checkout sebelum kehabisan stok.</span>
      </div>
      <Link
        className="btn btn-sm"
        to="/checkout"
        state={{ backgroundLocation: location }}
      >
        Checkout
      </Link>
      <button
        type="button"
        className="abandoned-cart-dismiss"
        aria-label="Tutup"
        onClick={() => {
          dismissAbandonedCartReminder();
          setDismissed(true);
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
