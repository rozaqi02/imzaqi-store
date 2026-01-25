import React from "react";

/**
 * 3-step helper to reduce anxiety in checkout flow.
 * current: "checkout" | "pay" | "status"
 */
export default function CheckoutSteps({ current = "checkout" }) {
  const steps = [
    { key: "checkout", title: "Checkout", subtitle: "Periksa keranjang" },
    { key: "pay", title: "Bayar", subtitle: "QRIS + upload" },
    { key: "status", title: "Status", subtitle: "Pantau proses" },
  ];

  const currentIndex = steps.findIndex((s) => s.key === current);

  return (
    <div className="steps" aria-label="Progress checkout">
      {steps.map((s, idx) => {
        const done = idx < currentIndex;
        const active = idx === currentIndex;
        const cls = done ? "step done" : active ? "step active" : "step";
        return (
          <div key={s.key} className={cls}>
            <div className="step-dot" aria-hidden="true">
              {done ? "✓" : idx + 1}
            </div>
            <div className="step-text">
              <div className="step-title">{s.title}</div>
              <div className="step-sub">{s.subtitle}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
