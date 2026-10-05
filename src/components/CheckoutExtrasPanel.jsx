import { useEffect, useRef, useState } from "react";
import { ChevronDown, TicketPercent } from "lucide-react";
import BannerGraphic from "./BannerGraphic";

export default function CheckoutExtrasPanel({ defaultOpen = false, promoSection }) {
  const [open, setOpen] = useState(defaultOpen);
  const panelRef = useRef(null);

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  const handleToggle = (event) => {
    const isNowOpen = event.currentTarget.open;
    setOpen(isNowOpen);
    if (isNowOpen) {
      setTimeout(() => {
        panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 60);
    }
  };

  return (
    <details
      ref={panelRef}
      className="checkout-extras-collapsible"
      open={open}
      onToggle={handleToggle}
    >
      <summary className="checkout-extras-summary">
        <BannerGraphic name="discount_tag" height={22} className="checkout-extras-mascot" />
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
