import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Crown,
  Eye,
  Package,
  PackageCheck,
  ShoppingBag,
} from "lucide-react";
import { useLiveStats } from "../hooks/useLiveStats";
import NumberCounter from "./NumberCounter";
import { supabase } from "../lib/supabaseClient";
import { useDeviceCapability } from "../hooks/useIsMobile";
import HeroCatalogBackdrop from "./HeroCatalogBackdrop";

function ActiveShoppersBadge() {
  const [activeShoppers, setActiveShoppers] = useState(1);

  useEffect(() => {
    const channel = supabase.channel("online-shoppers", {
      config: {
        presence: {
          key: "shopper-" + Math.random().toString(36).substring(2, 9),
        },
      },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const presenceState = channel.presenceState();
        const count = Object.keys(presenceState).length;
        setActiveShoppers(Math.max(1, count));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="hx-stat-item hx-stat-item--live">
      <span className="hx-stat-icon-wrap" aria-hidden="true">
        <Eye size={15} strokeWidth={2.4} className="hx-stat-icon hx-live-eye-icon" />
      </span>
      <div className="hx-stat-meta">
        <span className="hx-stat-val">{activeShoppers}</span>
        <span className="hx-stat-label">Pembeli Online</span>
      </div>
    </div>
  );
}

function HeroStatsRow({ activeProductCount }) {
  const { last7DaysViews, totalOrders } = useLiveStats({
    intervalMs: 60000,
  });

  const stats = [
    { val: totalOrders || 0, label: "Total Order", icon: ShoppingBag },
    { val: activeProductCount, label: "Produk Aktif", icon: Package },
    { val: last7DaysViews || 0, label: "Views 7 Hari", icon: Eye },
  ];

  return (
    <>
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <div
            key={s.label}
            className="hx-stat-item"
          >
            <span className="hx-stat-icon-wrap" aria-hidden="true">
              <Icon size={15} className="hx-stat-icon" />
            </span>
            <div className="hx-stat-meta">
              <span className="hx-stat-val">
                <NumberCounter value={s.val} />
              </span>
              <span className="hx-stat-label">{s.label}</span>
            </div>
          </div>
        );
      })}
    </>
  );
}

/* ── Main Hero ── */
const HERO_LOGO_SCROLL_RANGE = 75;
const HEADLINE_WORDS = ["Akses", "Premium", "Budget", "Pelajar"];

function useHeroVisibility() {
  // Latching entrance state: starts active immediately if page is visible,
  // or triggers once when a background tab becomes active. Never un-mounts or replays.
  const [active, setActive] = useState(() => {
    if (typeof document === "undefined") return true;
    return !document.hidden;
  });

  useEffect(() => {
    if (active) return undefined;

    const handleVisible = () => {
      if (!document.hidden) {
        setActive(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisible);
    return () => {
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, [active]);

  return active;
}

function HeroHeadline({ active = true, reduced = false } = {}) {
  const words = HEADLINE_WORDS.map((word, index) => {
    const isGradient = index % 2 === 1;
    return (
      <span className="hx-headline-mask" key={word}>
        <span
          className={`hx-headline-word hx-word-${index}${isGradient ? " hx-headline-gradient" : ""}`}
          style={{ "--w": index }}
        >
          {word}
        </span>
      </span>
    );
  });

  return (
    <h1
      className={`hx-headline hx-headline--kinetic${reduced ? " hx-headline--static" : " hx-headline--enter"}`}
      aria-label="Akses Premium Budget Pelajar"
    >
      <span className="hx-headline-line" aria-hidden="true">
        {words[0]}{" "}{words[1]}
      </span>
      <span className="hx-headline-line" aria-hidden="true">
        {words[2]}{" "}{words[3]}
      </span>
    </h1>
  );
}

export default function Hero({ products = [] }) {
  const caps = useDeviceCapability();
  const isMotionReduced = caps.isReducedMotion || caps.saveData || caps.lowMemory;
  const logoRef = useRef(null);
  const heroRef = useRef(null);
  const entranceActive = useHeroVisibility(heroRef);

  useEffect(() => {
    const logo = logoRef.current;
    if (!logo || typeof window === "undefined") return undefined;

    let frame = 0;
    const syncLogo = () => {
      frame = 0;
      const progress = Math.min(1, Math.max(0, window.scrollY / HERO_LOGO_SCROLL_RANGE));
      logo.style.setProperty("--logo-progress", progress.toFixed(3));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(syncLogo);
    };

    syncLogo();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const activeProductCount = useMemo(
    () =>
      (products || []).filter((p) =>
        (p?.product_variants || []).some((v) => v?.is_active)
      ).length,
    [products]
  );

  return (
    <section ref={heroRef} className="hx-hero hx-hero--choreographed" data-hero-active={entranceActive} data-hero-reduced={isMotionReduced} aria-label="Marketplace Hero">
      <HeroCatalogBackdrop products={products} />
      <div className="hx-hero-scrim" aria-hidden="true" />
      <Link ref={logoRef} to="/" className="hx-hero-logo" aria-label="Imzaqi Store">
        <img src="/icon.png" alt="Imzaqi Store" />
      </Link>
      <div className="container">
        <div className="hx-stage">
          <div className="hx-main">
            <div className="hx-eyebrow-row">
              <span className="hx-eyebrow">
                <Crown size={13} aria-hidden="true" />
                Marketplace langganan premium
              </span>
            </div>

             <HeroHeadline active={entranceActive} reduced={isMotionReduced} />

            <p className="hx-subtitle">
              Akses premium tanpa boncos: pilih paket, scan QRIS, lacak status order kamu.
            </p>

            <div className="hx-ctas-row">
              <Link className="hx-btn-primary" to="/produk">
                <ShoppingBag size={15} aria-hidden="true" />
                <span>Gas Lihat Katalog</span>
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
              <Link className="hx-btn-secondary" to="/status">
                <PackageCheck size={15} aria-hidden="true" />
                <span>Cek Status</span>
              </Link>
            </div>
          </div>

          <div className="hx-stats-row" aria-label="Statistik toko">
            <ActiveShoppersBadge />
            <HeroStatsRow activeProductCount={activeProductCount} />
          </div>
        </div>
      </div>
    </section>
  );
}
