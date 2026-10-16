import React from "react";
import { PackageSearch, QrCode } from "lucide-react";
import { useNavigate } from "react-router-dom";
import CartIcon from "./CartIcon";
import "../css/checkout-steps.css";

/**
 * 3-step helper to reduce anxiety in checkout flow.
 * current: "checkout" | "pay" | "status"
 * Step yang sudah selesai (done) bisa diklik untuk navigasi balik.
 */

const STEP_ROUTES = {
  checkout: "/checkout",
  pay: "/bayar",
  status: "/status",
};

// Konstanta di module level agar tidak dibuat ulang tiap render
const STEPS = [
  { key: "checkout", title: "Keranjang", subtitle: "Cek item", icon: CartIcon },
  { key: "pay", title: "Bayar", subtitle: "Scan QRIS", icon: QrCode },
  { key: "status", title: "Lacak", subtitle: "ID order", icon: PackageSearch },
];

export default function CheckoutSteps({ current = "checkout", readOnly = false }) {
  const navigate = useNavigate();
  const currentIndex = STEPS.findIndex((s) => s.key === current);

  return (
    <div className="steps steps--visual" aria-label="Progress checkout">
      <div className="steps-mobileSummary">
        <span>Langkah {currentIndex + 1} dari {STEPS.length}</span>
        <strong>{STEPS[currentIndex]?.title}</strong>
      </div>
      {STEPS.map((step, idx) => {
        const done = idx < currentIndex;
        const active = idx === currentIndex;
        const isClickable = done && !readOnly;
        const cls = isClickable ? "step done step--clickable" : done ? "step done" : active ? "step active" : "step";
        const Icon = step.icon;

        const handleClick = () => {
          if (isClickable && STEP_ROUTES[step.key]) {
            navigate(STEP_ROUTES[step.key]);
          }
        };

        const handleKeyDown = (e) => {
          if (isClickable && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            handleClick();
          }
        };

        return (
          <div
            key={step.key}
            className={cls}
            aria-current={active ? "step" : undefined}
            aria-posinset={idx + 1}
            aria-setsize={STEPS.length}
            role={isClickable ? "button" : undefined}
            tabIndex={isClickable ? 0 : undefined}
            onClick={isClickable ? handleClick : undefined}
            onKeyDown={isClickable ? handleKeyDown : undefined}
            title={isClickable ? `Kembali ke ${step.title}` : undefined}
          >
            <div className="step-dot" aria-hidden="true">
              <Icon size={16} strokeWidth={2.2} />
            </div>
            <div className="step-text">
              <div className="step-title">{step.title}</div>
              <div className="step-sub">{isClickable ? "← kembali" : step.subtitle}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
