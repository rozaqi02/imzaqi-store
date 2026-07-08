import React from "react";
import { Check, PackageSearch, QrCode, ShoppingBag } from "lucide-react";
import "../css/checkout-steps.css";

/**
 * 3-step helper to reduce anxiety in checkout flow.
 * current: "checkout" | "pay" | "status"
 */
export default function CheckoutSteps({ current = "checkout" }) {
  const steps = [
    { key: "checkout", title: "Keranjang", subtitle: "Cek item", icon: ShoppingBag },
    { key: "pay", title: "Bayar", subtitle: "Scan QRIS", icon: QrCode },
    { key: "status", title: "Lacak", subtitle: "ID order", icon: PackageSearch },
  ];

  const currentIndex = steps.findIndex((s) => s.key === current);

  return (
    <div className="steps steps--visual" aria-label="Progress checkout">
      {steps.map((step, idx) => {
        const done = idx < currentIndex;
        const active = idx === currentIndex;
        const cls = done ? "step done" : active ? "step active" : "step";
        const Icon = step.icon;

        return (
          <div
            key={step.key}
            className={cls}
            aria-current={active ? "step" : undefined}
            aria-posinset={idx + 1}
            aria-setsize={steps.length}
          >
            <div className="step-dot" aria-hidden="true">
              {done ? (
                <Check size={15} strokeWidth={2.8} />
              ) : (
                <Icon size={16} strokeWidth={2.2} />
              )}
            </div>
            <div className="step-text">
              <div className="step-title">{step.title}</div>
              <div className="step-sub">{step.subtitle}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}