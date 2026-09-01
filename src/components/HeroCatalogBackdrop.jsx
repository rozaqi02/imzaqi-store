import React, { useEffect, useMemo, useRef } from "react";
import { useDeviceCapability, useMediaQuery } from "../hooks/useIsMobile";

const DESKTOP_ROW_COUNT = 4;
// One source row must be wider than the stage. Three copies then keep both
// directions continuously filled throughout the marquee animation.
const DESKTOP_MIN_TILES = 18;
const MOBILE_ROW_COUNT = 5;
const MOBILE_MIN_TILES = 8;
const ROW_DURATIONS = ["88s", "104s", "96s", "112s"];
const MOBILE_ROW_DURATIONS = ["120s", "136s", "128s", "144s", "124s"];

function getBackdropConfig(caps, isNarrowViewport) {
  // A desktop touchscreen can report `pointer: coarse`. The backdrop should
  // still use its desktop four-row layout when there is desktop-width space.
  const isMobile = isNarrowViewport;
  const motionOff =
    caps?.isReducedMotion || caps?.saveData || caps?.lowMemory;

  if (isMobile) {
    return {
      isMobile: true,
      motionOff,
      rowCount: MOBILE_ROW_COUNT,
      minTilesPerRow: MOBILE_MIN_TILES,
      durations: MOBILE_ROW_DURATIONS,
    };
  }

  return {
    isMobile: false,
    motionOff,
    rowCount: DESKTOP_ROW_COUNT,
    minTilesPerRow: DESKTOP_MIN_TILES,
    durations: ROW_DURATIONS,
  };
}

function buildProductPool(products, config) {
  const active = (products || []).filter(
    (product) =>
      product?.is_active !== false &&
      (product?.icon_url || product?.name)
  );

  if (!active.length) return [];

  const minPool = config.minTilesPerRow * config.rowCount;
  let pool = [...active];
  while (pool.length < minPool) {
    pool = [...pool, ...active];
  }
  return pool;
}

function buildRows(pool, config) {
  if (!pool.length) return [];

  // Background dekoratif cukup memakai sampel kecil katalog; tidak perlu
  // menggandakan seluruh daftar produk di atas lipatan pertama.
  const perRow = config.minTilesPerRow;

  return Array.from({ length: config.rowCount }, (_, index) => {
    const offset = index * 2;
    const items = [];
    for (let i = 0; i < perRow; i += 1) {
      items.push(pool[(offset + i) % pool.length]);
    }
    return {
      id: index,
      direction: index % 2 === 0 ? "left" : "right",
      duration: config.durations[index % config.durations.length],
      items,
    };
  });
}

function CatalogTile({ product, compact = false, eager = false }) {
  const name = product?.name || "Produk";
  const initial = String(name).slice(0, 1).toUpperCase();

  return (
    <article className={`hx-catalog-tile${compact ? " is-compact" : ""}`} aria-hidden="true">
      <div className="hx-catalog-tile-icon">
        {product?.icon_url ? (
          <img
            src={product.icon_url}
            alt=""
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={eager ? "high" : "low"}
            draggable={false}
          />
        ) : (
          <span>{initial}</span>
        )}
      </div>
      {compact ? null : <p className="hx-catalog-tile-name">{name}</p>}
    </article>
  );
}

export default function HeroCatalogBackdrop({ products = [] }) {
  const caps = useDeviceCapability();
  const isNarrowViewport = useMediaQuery("(max-width: 720px)");
  const config = useMemo(
    () => getBackdropConfig(caps, isNarrowViewport),
    [isNarrowViewport, caps.isReducedMotion, caps.saveData, caps.lowMemory]
  );
  const rootRef = useRef(null);

  const rows = useMemo(
    () => buildRows(buildProductPool(products, config), config),
    [products, config]
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root || config.motionOff) return undefined;

    const hero = root.closest(".hx-hero");
    if (!(hero instanceof HTMLElement)) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        root.classList.toggle("is-paused", !entry?.isIntersecting || document.hidden);
      },
      { threshold: 0.08, rootMargin: "40px 0px" }
    );

    observer.observe(hero);

    const handleVisibility = () => {
      root.classList.toggle("is-paused", document.hidden);
    };
    document.addEventListener("visibilitychange", handleVisibility, { passive: true });

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [config.motionOff]);

  // Always mount shell so hero never waits on empty state flash
  const className = [
    "hx-catalog-backdrop",
    "is-ready",
    config.isMobile ? "is-mobile" : "",
    config.motionOff ? "is-static" : "",
    rows.length ? "" : "is-empty",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={rootRef} className={className} aria-hidden="true">
      <div className="hx-catalog-stage">
        {rows.map((row) => (
          <div
            key={row.id}
            className={`hx-catalog-row hx-catalog-row--${row.direction}`}
            style={{ "--row-duration": row.duration, "--row-i": row.id }}
          >
            <div className="hx-catalog-track">
              {row.items.map((product, idx) => (
                <CatalogTile
                  key={`${row.id}-a-${product.id}-${idx}`}
                  product={product}
                  eager={row.id < 2 && idx < 4}
                />
              ))}
              {!config.motionOff ? (
                <>
                  {row.items.map((product, idx) => (
                    <CatalogTile
                      key={`${row.id}-b-${product.id}-${idx}`}
                      product={product}
                      eager={false}
                    />
                  ))}
                  {row.items.map((product, idx) => (
                    <CatalogTile
                      key={`${row.id}-c-${product.id}-${idx}`}
                      product={product}
                      eager={false}
                    />
                  ))}
                </>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
