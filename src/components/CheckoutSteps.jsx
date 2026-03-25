import React from "react";
import { Check } from "lucide-react";

/**
 * 3-step helper to reduce anxiety in checkout flow.
 * current: "checkout" | "pay" | "status"
 */
export default function CheckoutSteps({ current = "checkout" }) {
  const steps = [
    { key: "checkout", title: "Review", subtitle: "Item" },
    { key: "pay", title: "Bayar", subtitle: "QRIS" },
    { key: "status", title: "Status", subtitle: "Order" },
  ];

  const currentIndex = steps.findIndex((s) => s.key === current);

  return (
    <div className="steps" aria-label="Progress checkout">
      {steps.map((step, idx) => {
        const done = idx < currentIndex;
        const active = idx === currentIndex;
        const cls = done ? "step done" : active ? "step active" : "step";

        return (
          <div key={step.key} className={cls}>
            <div className="step-dot" aria-hidden="true">
              {done ? <Check size={14} strokeWidth={3} /> : idx + 1}
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
