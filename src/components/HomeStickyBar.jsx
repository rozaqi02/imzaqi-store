import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Activity, LayoutGrid, ShoppingCart } from "lucide-react";
import { useCart } from "../context/CartContext";

export default function HomeStickyBar() {
  const { items } = useCart();
  const location = useLocation();
  const [enabled, setEnabled] = useState(false);
  const [visible, setVisible] = useState(false);

  const cartCount = items.reduce((sum, item) => sum + Number(item.qty || 0), 0);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;

    const mq = window.matchMedia("(max-width: 720px)");
    const syncEnabled = () => setEnabled(mq.matches);
    syncEnabled();

    if (typeof mq.addEventListener === "function") mq.addEventListener("change", syncEnabled);
    else mq.addListener(syncEnabled);

    return () => {
      if (typeof mq.removeEventListener === "function") mq.removeEventListener("change", syncEnabled);
      else mq.removeListener(syncEnabled);
    };
  }, []);

  useEffect(() => {
    if (!enabled || typeof document === "undefined") {
      setVisible(false);
      return undefined;
    }

    const hero = document.querySelector(".hx-hero");
    if (!hero) return undefined;

    const io = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { threshold: 0, rootMargin: "0px" }
    );

    io.observe(hero);
    return () => io.disconnect();
  }, [enabled]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    document.body.classList.toggle("home-stickyBar-active", enabled && visible);
    return () => document.body.classList.remove("home-stickyBar-active");
  }, [enabled, visible]);

  if (!enabled) return null;

  return (
    <nav
      className={`home-stickyBar${visible ? " is-visible" : ""}`}
      aria-label="Navigasi cepat"
      aria-hidden={!visible}
    >
      <Link to="/produk" className="home-stickyBar-link">
        <LayoutGrid size={16} aria-hidden="true" />
        <span>Katalog</span>
      </Link>
      <Link to="/status" className="home-stickyBar-link">
        <Activity size={16} aria-hidden="true" />
        <span>Status</span>
      </Link>
      <Link to="/checkout" state={{ backgroundLocation: location }} className="home-stickyBar-link">
        <ShoppingCart size={16} aria-hidden="true" />
        <span>Keranjang</span>
        {cartCount > 0 ? <span className="home-stickyBar-badge">{cartCount}</span> : null}
      </Link>
    </nav>
  );
}