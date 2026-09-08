import { useEffect, useState } from "react";
import { ChevronDown, TicketPercent } from "lucide-react";

export default function CheckoutExtrasPanel({ defaultOpen = false, promoSection }) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  return (
    <details
      className="checkout-extras-collapsible"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="checkout-extras-summary">
        <TicketPercent size={16} aria-hidden="true" />
        <span>
          <strong>Punya kode promo?</strong>
          <small>Buka dan masukkan kodenya di sini</small>
        </span>
        <ChevronDown size={16} className="checkout-extras-chevron" aria-hidden="true" />
      </summary>
      <div className="checkout-extras-body">{promoSection}</div>
    </details>
  );
}
