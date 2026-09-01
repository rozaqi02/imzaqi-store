import React from "react";
import { Check, PackageSearch, QrCode, ShoppingBag } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
  { key: "checkout", title: "Keranjang", subtitle: "Cek item", icon: ShoppingBag },
  { key: "pay", title: "Bayar", subtitle: "Scan QRIS", icon: QrCode },
  { key: "status", title: "Lacak", subtitle: "ID order", icon: PackageSearch },
];

export default function CheckoutSteps({ current = "checkout" }) {
  const navigate = useNavigate();
  const currentIndex = STEPS.findIndex((s) => s.key === current);

  return (
    <div className="steps steps--visual" aria-label="Progress checkout">
      {STEPS.map((step, idx) => {
        const done = idx < currentIndex;
        const active = idx === currentIndex;
        const cls = done ? "step done step--clickable" : active ? "step active" : "step";
        const Icon = step.icon;

        const handleClick = () => {
          if (done && STEP_ROUTES[step.key]) {
            navigate(STEP_ROUTES[step.key]);
          }
        };

        const handleKeyDown = (e) => {
          if (done && (e.key === "Enter" || e.key === " ")) {
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
            role={done ? "button" : undefined}
            tabIndex={done ? 0 : undefined}
            onClick={done ? handleClick : undefined}
            onKeyDown={done ? handleKeyDown : undefined}
            title={done ? `Kembali ke ${step.title}` : undefined}
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
              <div className="step-sub">{done ? "← kembali" : step.subtitle}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
