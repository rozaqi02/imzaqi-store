import { ChevronDown, ShieldCheck } from "lucide-react";
import CheckoutTrustBlock from "./CheckoutTrustBlock";

export default function CheckoutExtrasPanel({ collapsed, promoSection }) {
  if (!collapsed) {
    return (
      <>
        {promoSection}
        <CheckoutTrustBlock />
      </>
    );
  }

  return (
    <details className="checkout-extras-collapsible">
      <summary className="checkout-extras-summary">
        <ShieldCheck size={16} aria-hidden="true" />
        <span>Keamanan & promo</span>
        <ChevronDown size={16} className="checkout-extras-chevron" aria-hidden="true" />
      </summary>
      <div className="checkout-extras-body">
        {promoSection}
        <CheckoutTrustBlock />
      </div>
    </details>
  );
}