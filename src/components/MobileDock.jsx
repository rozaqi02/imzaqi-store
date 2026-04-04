import React, { useMemo } from "react";
import { Activity, Grid2x2, House, ShoppingBag } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useCart } from "../context/CartContext";

function DockLink({ item, active, badge, state }) {
  const Icon = item.icon;

  return (
    <Link
      className={`mobile-dock-link${active ? " active" : ""}`}
      to={item.to}
      state={state}
      aria-current={active ? "page" : undefined}
    >
      <span className="mobile-dock-icon">
        <Icon size={17} strokeWidth={2.1} />
        {badge ? <span className="mobile-dock-badge">{badge}</span> : null}
      </span>
      <span className="mobile-dock-label">{item.label}</span>
    </Link>
  );
}

export default function MobileDock() {
  const location = useLocation();
  const { items } = useCart();
  const cartCount = useMemo(() => items.reduce((sum, item) => sum + Number(item.qty || 0), 0), [items]);
  const pathname = location.pathname;

  const hidden =
    pathname === "/checkout" ||
    pathname === "/bayar" ||
    pathname.startsWith("/admin");

  if (hidden) return null;

  const links = [
    { to: "/", label: "Home", icon: House },
    { to: "/produk", label: "Produk", icon: Grid2x2 },
    { to: "/status", label: "Status", icon: Activity },
    { to: "/checkout", label: "Checkout", icon: ShoppingBag, badge: cartCount > 0 ? cartCount : "" },
  ];

  return (
    <nav className="mobile-dock" aria-label="Navigasi cepat">
      <div className="mobile-dock-inner">
        {links.map((item) => {
          const active =
            item.to === "/"
              ? pathname === "/"
              : item.to === "/checkout"
                ? pathname === "/checkout"
                : pathname === item.to || pathname.startsWith(`${item.to}/`);

          return (
            <DockLink
              key={item.to}
              item={item}
              active={active}
              badge={item.badge}
              state={item.to === "/checkout" ? { backgroundLocation: location } : undefined}
            />
          );
        })}
      </div>
    </nav>
  );
}
