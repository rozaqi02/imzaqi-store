import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Eye,
  Package,
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
    <span className="hx-live-badge">
      <span className="hx-live-eye" aria-hidden="true">
        <Eye size={14} strokeWidth={2.4} className="hx-live-eye-icon" />
      </span>
      <span>
        <strong>{activeShoppers}</strong> pembeli online
      </span>
    </span>
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
export default function Hero({ products = [] }) {
  const caps = useDeviceCapability();
  const isMotionReduced = caps.isReducedMotion || caps.saveData || caps.lowMemory;

  const activeProductCount = useMemo(
    () =>
      (products || []).filter((p) =>
        (p?.product_variants || []).some((v) => v?.is_active)
      ).length,
    [products]
  );

  return (
    <section className="hx-hero" aria-label="Marketplace Hero">
      <HeroCatalogBackdrop products={products} />
      <div className="hx-hero-scrim" aria-hidden="true" />
      <div className="container">
        <div className="hx-stage">
          <div className="hx-main">
            <div className="hx-eyebrow-row">
              <ActiveShoppersBadge />
            </div>

            <h1
              className={`hx-headline${isMotionReduced ? " hx-headline--static" : " hx-headline--enter"}`}
            >
              <span className="hx-headline-line">
                <span className="hx-headline-mask">
                  <span className="hx-headline-word" style={{ "--w": 0 }}>
                    Akses
                  </span>
                </span>{" "}
                <span className="hx-headline-mask">
                  <span className="hx-headline-word hx-headline-gradient" style={{ "--w": 1 }}>
                    Premium
                  </span>
                </span>
              </span>
              <span className="hx-headline-line">
                <span className="hx-headline-mask">
                  <span className="hx-headline-word" style={{ "--w": 2 }}>
                    Budget
                  </span>
                </span>{" "}
                <span className="hx-headline-mask">
                  <span className="hx-headline-word hx-headline-gradient" style={{ "--w": 3 }}>
                    Pelajar
                  </span>
                </span>
              </span>
            </h1>

            <p className="hx-subtitle">
              Akses premium tanpa boncos: pilih paket, scan QRIS, lacak status order kamu.
            </p>

            <div className="hx-ctas-row">
              <Link className="hx-btn-primary" to="/produk">
                <ShoppingBag size={15} aria-hidden="true" />
                <span>Gas Lihat Katalog</span>
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="hx-stats-row" aria-label="Statistik toko">
            <HeroStatsRow activeProductCount={activeProductCount} />
          </div>
        </div>
      </div>
    </section>
  );
}
