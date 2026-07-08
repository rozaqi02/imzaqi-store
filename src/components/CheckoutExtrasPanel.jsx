import { ChevronDown, TicketPercent } from "lucide-react";

export default function CheckoutExtrasPanel({ collapsed, promoSection }) {
  if (!collapsed) {
    return promoSection;
  }

  return (
    <details className="checkout-extras-collapsible">
      <summary className="checkout-extras-summary">
        <TicketPercent size={16} aria-hidden="true" />
        <span>Kode promo</span>
        <ChevronDown size={16} className="checkout-extras-chevron" aria-hidden="true" />
      </summary>
      <div className="checkout-extras-body">{promoSection}</div>
    </details>
  );
}