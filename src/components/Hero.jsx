import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  PackageCheck,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useLiveStats } from "../hooks/useLiveStats";
import NumberCounter from "./NumberCounter";
import { useDeviceCapability } from "../hooks/useIsMobile";
import HeroCatalogBackdrop from "./HeroCatalogBackdrop";

/* ── Trust Bar (Replaces generic 4-box dashboard cards with bespoke e-commerce proof) ── */
function HeroTrustBar({ activeProductCount, isProductsLoading = false }) {
  const { totalOrders, loading } = useLiveStats({
    intervalMs: 60000,
  });

  const orderCount = totalOrders || 200;
  const productCount = activeProductCount || 25;

  return (
    <div className="hx-trust-bar" role="region" aria-label="Jaminan & Bukti Toko">
      <div className="hx-trust-item">
        <ShieldCheck size={14} className="hx-trust-icon" aria-hidden="true" />
        <span className="hx-trust-text">
          <strong>
            {loading && !totalOrders ? (
              "200+"
            ) : (
              <>
                <NumberCounter value={orderCount} />+
              </>
            )}
          </strong>{" "}
          Pesanan Sukses
        </span>
      </div>

      <span className="hx-trust-divider" aria-hidden="true" />

      <div className="hx-trust-item">
        <Zap size={14} className="hx-trust-icon" aria-hidden="true" />
        <span className="hx-trust-text">
          <strong>
            {isProductsLoading && !activeProductCount ? (
              "25+"
            ) : (
              <>
                <NumberCounter value={productCount} />+
              </>
            )}
          </strong>{" "}
          Layanan Aktif
        </span>
      </div>

      <span className="hx-trust-divider" aria-hidden="true" />

      <div className="hx-trust-item">
        <CheckCircle2 size={14} className="hx-trust-icon" aria-hidden="true" />
        <span className="hx-trust-text">
          <strong>Garansi Penuh</strong> &amp; Proses Cepat
        </span>
      </div>
    </div>
  );
}

/* ── Main Hero ── */
const HERO_LOGO_SCROLL_RANGE = 75;
const HEADLINE_WORDS = ["Akses", "Premium", "Budget", "Pelajar"];

function useHeroVisibility() {
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
  // Line 1: "Akses Premium" (solid editorial tone)
  // Line 2: "Budget Pelajar" (unified accent phrase, no alternating word-by-word colors)
  const words = HEADLINE_WORDS.map((word, index) => {
    const isAccent = index >= 2;
    return (
      <span className="hx-headline-mask" key={word}>
        <span
          className={`hx-headline-word hx-word-${index}${isAccent ? " hx-headline-gradient" : ""}`}
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

export default function Hero({ products = [], loading = false }) {
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
        p && p.is_active !== false && (p?.product_variants || []).some((v) => v?.is_active !== false)
      ).length,
    [products]
  );

  return (
    <section ref={heroRef} className="hx-hero hx-hero--choreographed" data-hero-active={entranceActive} data-hero-reduced={isMotionReduced} aria-label="Marketplace Hero">
      <HeroCatalogBackdrop />
      <div className="hx-hero-scrim" aria-hidden="true" />
      <Link ref={logoRef} to="/" className="hx-hero-logo" aria-label="Imzaqi Store">
        <img src="/icon.png" alt="Imzaqi Store" />
      </Link>
      <div className="container">
        <div className="hx-stage">
          <div className="hx-main">
            <HeroHeadline active={entranceActive} reduced={isMotionReduced} />

            <p className="hx-subtitle">
              Pilih paket, bayar QRIS, lacak status order.
            </p>

            <div className="hx-ctas-row">
              <Link className="hx-btn-primary" to="/produk">
                <span>Lihat Katalog</span>
                <ArrowRight size={16} aria-hidden="true" className="hx-btn-arrow" />
              </Link>
              <Link className="hx-btn-secondary" to="/status">
                <PackageCheck size={16} aria-hidden="true" />
                <span>Cek Status</span>
              </Link>
            </div>
          </div>

          <HeroTrustBar
            activeProductCount={activeProductCount}
            isProductsLoading={loading || (!products || products.length === 0)}
          />
        </div>
      </div>
    </section>
  );
}
