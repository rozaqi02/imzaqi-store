import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, ChevronLeft, ChevronRight, Clock3, PackageCheck, Zap } from "lucide-react";
import { fetchActiveFlashSales } from "../lib/api";
import { warn } from "../lib/log";
import { buildFlashOffers, flashCountdown, flashPrice } from "../lib/flashOffers";

function ProductLogo({ product }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [product.icon_url]);
  return product.icon_url && !failed ? (
    <img src={product.icon_url} alt="" decoding="async" onError={() => setFailed(true)} />
  ) : <span aria-hidden="true">{String(product.name || "P").slice(0, 1).toUpperCase()}</span>;
}

export default function FlashSaleBanner({ products = [] }) {
  const titleId = useId();
  const offerId = useId();
  const railRef = useRef(null);
  const [sales, setSales] = useState([]);
  const [now, setNow] = useState(Date.now);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    let alive = true;
    let pending = false;
    async function refresh(useCache) {
      if (pending) return;
      pending = true;
      try {
        const result = await fetchActiveFlashSales({ useCache });
        if (alive) { setSales(result); setNow(Date.now()); }
      } catch (error) {
        if (alive) warn("Flash sale load failed:", error);
      } finally { pending = false; }
    }
    refresh(true);
    const poll = setInterval(() => {
      if (document.visibilityState !== "hidden") refresh(false);
    }, 60_000);
    const onVisible = () => {
      if (document.visibilityState !== "hidden") refresh(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    if (!sales.length) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [sales.length]);

  const offers = useMemo(() => buildFlashOffers(sales, products, now), [sales, products, now]);
  const selectedIndex = Math.max(0, offers.findIndex(offer => offer.id === selectedId));
  const offer = offers[selectedIndex];

  // Move only the horizontal rail; keep the page and keyboard focus in place.
  useEffect(() => {
    const rail = railRef.current;
    const active = rail?.querySelector('[data-selected="true"]');
    if (!active) return;
    const left = active.offsetLeft - rail.offsetLeft;
    if (left < rail.scrollLeft) rail.scrollLeft = left;
    else if (left + active.offsetWidth > rail.scrollLeft + rail.clientWidth) {
      rail.scrollLeft = left + active.offsetWidth - rail.clientWidth;
    }
  }, [offer?.id, offers.length]);

  if (!offer) return null;
  const units = flashCountdown(offer.endsAt, now);
  const chooseAdjacent = direction => setSelectedId(offers[(selectedIndex + direction + offers.length) % offers.length].id);

  return (
    <section className="flash-drop" aria-labelledby={titleId}>
      <div className="fsd-campaign">
        <Zap className="fsd-watermark" size={250} strokeWidth={0.8} aria-hidden="true" />
        <div className="fsd-eyebrow"><Zap size={14} fill="currentColor" aria-hidden="true" /> Flash sale <span>IMZAQI / PILIHAN HEMAT</span></div>
        <h2 id={titleId} className="fsd-headline">Premium.<br /><em>Harga miring.</em></h2>
        <p className="fsd-intro">Paket favoritmu, dengan harga yang lebih ringan.</p>
        <div className="fsd-clock">
          <span className="fsd-clockLabel"><Clock3 size={13} aria-hidden="true" /> Promo ini berakhir dalam</span>
          <div className="fsd-digits" role="timer" aria-live="off" aria-label={units.map(unit => `${unit.value} ${unit.label}`).join(" ")}>
            {units.map(unit => <span className="fsd-unit" key={unit.label}>
              <strong>{String(unit.value).padStart(2, "0")}</strong><small>{unit.label}</small>
            </span>)}
          </div>
        </div>
      </div>

      <div className="fsd-ticket" id={offerId}>
        <div className="fsd-ticketTop"><span>HARGA SPESIAL / {String(selectedIndex + 1).padStart(2, "0")}</span><span className="fsd-ticketBrand">imzaqi.store</span></div>
        <div className="fsd-offer">
          <div className="fsd-art" aria-hidden="true">
            <div className="fsd-logo" key={`${offer.product.id}-${offer.product.icon_url}`}><ProductLogo product={offer.product} /></div>
            <div className="fsd-seal"><small>DISKON</small><strong>{offer.discountPercent}<span>%</span></strong></div>
          </div>
          <div className="fsd-details">
            <h3>{offer.product.name}</h3>
            <p className="fsd-package">{offer.variant.name}{offer.variant.duration_label ? <span>{offer.variant.duration_label}</span> : null}</p>
            <div className="fsd-price"><del>{flashPrice(offer.originalPrice)}</del><strong>{flashPrice(offer.discountedPrice)}</strong></div>
            <span className="fsd-saving">Hemat {flashPrice(offer.saving)}</span>
          </div>
        </div>
        <div className="fsd-ticketBottom">
          <span className="fsd-stock"><PackageCheck size={14} aria-hidden="true" />{offer.stock == null ? "Paket tersedia" : `Stok ${offer.stock}`}</span>
          <Link className="fsd-cta" to={`/produk/${offer.product.slug}`} aria-label={`Lihat paket ${offer.product.name}, ${offer.variant.name}`}>
            Lihat paket <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </div>

      {offers.length > 1 ? <div className="fsd-switcher">
        <div className="fsd-switchLabel"><span>PILIH PROMO</span><div className="fsd-arrows">
          <button type="button" onClick={() => chooseAdjacent(-1)} aria-label="Promo sebelumnya" aria-controls={offerId}><ChevronLeft size={16} aria-hidden="true" /></button>
          <button type="button" onClick={() => chooseAdjacent(1)} aria-label="Promo berikutnya" aria-controls={offerId}><ChevronRight size={16} aria-hidden="true" /></button>
        </div></div>
        <div className="fsd-rail" ref={railRef} role="group" aria-label="Pilihan promo flash sale">
          {offers.map(item => <button type="button" className="fsd-choice" key={item.id} data-selected={item.id === offer.id}
            aria-pressed={item.id === offer.id} aria-controls={offerId} onClick={() => setSelectedId(item.id)}>
            <span className="fsd-choiceLogo"><ProductLogo product={item.product} /></span>
            <span className="fsd-choiceCopy"><strong>{item.product.name}</strong><small>{[item.variant.name, item.variant.duration_label].filter(Boolean).join(" · ")}</small></span>
            <span className="fsd-choiceDiscount">−{item.discountPercent}%</span>
          </button>)}
        </div>
      </div> : null}
    </section>
  );
}
