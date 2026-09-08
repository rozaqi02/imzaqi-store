import React, { useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { useStorefrontOverlayBlocked } from "../hooks/useFunnelRoute";
import { Clock, X } from "lucide-react";
import { fetchActiveFlashSales, fetchProducts } from "../lib/api";
import { formatIDR, isKnownOutOfStock } from "../lib/format";
import { OVERLAY_TIMING } from "../lib/overlayScheduler";
import { useDialogA11y } from "../hooks/useDialogA11y";

const SUPPRESS_DATE_KEY = "imzaqi_flash_sale_suppress_date_v1";
const SESSION_DONE_KEY = "imzaqi_flash_sale_popup_done";

function getTodayString() {
  return new Date().toDateString();
}

function wasHandledThisSession() {
  try {
    return sessionStorage.getItem(SESSION_DONE_KEY) === "true";
  } catch {
    return false;
  }
}

function markSessionDone() {
  try {
    sessionStorage.setItem(SESSION_DONE_KEY, "true");
  } catch {}
}

export default function FlashSalePopup() {
  const navigate = useNavigate();
  const location = useLocation();
  const overlayBlocked = useStorefrontOverlayBlocked();
  const [isOpen, setIsOpen] = useState(false);
  const [salesItems, setSalesItems] = useState([]);
  const [closestEndTime, setClosestEndTime] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [sessionDismissed, setSessionDismissed] = useState(() => wasHandledThisSession());
  const [isSuppressed, setIsSuppressed] = useState(() => {
    try {
      return localStorage.getItem(SUPPRESS_DATE_KEY) === getTodayString();
    } catch {
      return false;
    }
  });

  const modalRef = useRef(null);

  useEffect(() => {
    let active = true;

    async function loadPromoData() {
      try {
        const [flashSales, products] = await Promise.all([
          fetchActiveFlashSales({ useCache: true }),
          fetchProducts({ includeInactive: false }),
        ]);

        if (!active) return;
        if (!flashSales || !flashSales.length || !products || !products.length) return;

        const enriched = [];
        let minEndTime = null;

        flashSales.forEach((sale) => {
          for (const product of products) {
            const variant = (product.product_variants || []).find((v) => v.id === sale.variant_id);

            if (variant && variant.is_active) {
              const promoPrice = Math.round(variant.price_idr * (1 - sale.discount_percent / 100));

              enriched.push({
                saleId: sale.id,
                variantId: variant.id,
                productName: product.name,
                productSlug: product.slug,
                productIconUrl: product.icon_url,
                variantName: variant.name,
                durationLabel: variant.duration_label,
                originalPrice: variant.price_idr,
                discountPercent: sale.discount_percent,
                promoPrice,
                endsAt: sale.ends_at,
                stock: Number.isFinite(Number(variant.stock)) ? Number(variant.stock) : null,
              });

              const saleEndTime = new Date(sale.ends_at).getTime();
              if (!minEndTime || saleEndTime < minEndTime) minEndTime = saleEndTime;
              break;
            }
          }
        });

        if (enriched.length > 0 && active) {
          setSalesItems(enriched);
          setClosestEndTime(minEndTime);
        }
      } catch (err) {
        console.warn("[FlashSalePopup] Gagal memuat data flash sale:", err);
      }
    }

    loadPromoData();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const suppressedToday = localStorage.getItem(SUPPRESS_DATE_KEY) === getTodayString();
    if (
      suppressedToday ||
      sessionDismissed ||
      wasHandledThisSession() ||
      overlayBlocked ||
      location.pathname !== "/" ||
      salesItems.length === 0
    ) {
      return undefined;
    }

    let queuedTimer = null;

    const checkAndOpenFlashSale = () => {
      if (wasHandledThisSession()) return;
      const isAcademicActive = Boolean(
        window.__imzaqi_academic_popup_active || document.querySelector(".ac-popup-backdrop")
      );
      if (isAcademicActive) return;
      setIsOpen(true);
    };

    const handleAcademicPopupClosed = () => {
      if (wasHandledThisSession()) return;
      if (queuedTimer) clearTimeout(queuedTimer);
      queuedTimer = setTimeout(checkAndOpenFlashSale, 400);
    };

    const initialTimer = setTimeout(checkAndOpenFlashSale, OVERLAY_TIMING.flashSaleMs);
    window.addEventListener("imzaqi_academic_popup_closed", handleAcademicPopupClosed);

    return () => {
      clearTimeout(initialTimer);
      if (queuedTimer) clearTimeout(queuedTimer);
      window.removeEventListener("imzaqi_academic_popup_closed", handleAcademicPopupClosed);
    };
  }, [location.pathname, overlayBlocked, salesItems.length, sessionDismissed]);

  useEffect(() => {
    if (overlayBlocked) setIsOpen(false);
  }, [overlayBlocked]);

  useEffect(() => {
    if (!isOpen || !closestEndTime) return undefined;

    function updateTimer() {
      const now = Date.now();
      const diff = closestEndTime - now;

      if (diff <= 0) {
        setTimeLeft({ expired: true, hours: "00", minutes: "00", seconds: "00" });
        setIsOpen(false);
        return;
      }

      setTimeLeft({
        expired: false,
        hours: String(Math.floor(diff / 3600000)).padStart(2, "0"),
        minutes: String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0"),
        seconds: String(Math.floor((diff % 60000) / 1000)).padStart(2, "0"),
      });
    }

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isOpen, closestEndTime]);

  const handleClose = () => {
    markSessionDone();
    setSessionDismissed(true);
    setIsOpen(false);
  };

  useDialogA11y({
    open: isOpen && !overlayBlocked,
    containerRef: modalRef,
    onClose: handleClose,
    initialFocusSelector: ".fsp-closeFloat",
  });

  const featured = useMemo(() => {
    const live = salesItems.filter((item) => !isKnownOutOfStock(item));
    const pool = live.length ? live : [];
    if (!pool.length) return null;
    return [...pool].sort((a, b) => Number(b.discountPercent || 0) - Number(a.discountPercent || 0))[0];
  }, [salesItems]);

  const extras = useMemo(
    () => salesItems.filter((item) => item.saleId !== featured?.saleId).slice(0, 3),
    [salesItems, featured]
  );

  const isAcademicActive = Boolean(
    window.__imzaqi_academic_popup_active ||
      (typeof document !== "undefined" && document.querySelector(".ac-popup-backdrop"))
  );

  if (
    overlayBlocked ||
    location.pathname !== "/" ||
    !isOpen ||
    !featured ||
    isAcademicActive ||
    isSuppressed ||
    sessionDismissed ||
    wasHandledThisSession()
  ) {
    return null;
  }

  const featuredIcon = String(featured.productIconUrl || "").trim();

  function goProduct(slug) {
    markSessionDone();
    setSessionDismissed(true);
    setIsOpen(false);
    navigate(`/produk/${slug}`);
  }

  return createPortal(
    <div className="fsp-backdrop" onMouseDown={handleClose} role="presentation">
      <div
        ref={modalRef}
        className="fsp-stage"
        role="dialog"
        aria-modal="true"
        aria-labelledby="flash-sale-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button type="button" className="fsp-closeFloat" onClick={handleClose} aria-label="Tutup">
          <X size={18} aria-hidden="true" />
        </button>

        <article className="fsp-billboard">
          <div className="fsp-visual">
            <span className="fsp-off">-{featured.discountPercent}%</span>
            <div className="fsp-visualIcon">
              {featuredIcon ? (
                <img src={featuredIcon} alt="" fetchPriority="high" decoding="async" />
              ) : (
                <span>{String(featured.productName || "P").slice(0, 1).toUpperCase()}</span>
              )}
            </div>
          </div>

          <div className="fsp-copy">
            <p className="fsp-label">Flash sale</p>
            <h2 id="flash-sale-title" className="fsp-headline">
              {featured.productName}
            </h2>
            <p className="fsp-meta">{[featured.variantName, featured.durationLabel].filter(Boolean).join(" · ")}</p>

            <div className="fsp-priceRow">
              <span className="fsp-now">{formatIDR(featured.promoPrice)}</span>
              <span className="fsp-was">{formatIDR(featured.originalPrice)}</span>
            </div>

            {timeLeft && !timeLeft.expired ? (
              <p className="fsp-timer" aria-label={`Sisa ${timeLeft.hours} jam ${timeLeft.minutes} menit`}>
                <Clock size={14} aria-hidden="true" />
                {timeLeft.hours}:{timeLeft.minutes}:{timeLeft.seconds}
              </p>
            ) : null}

            <button type="button" className="fsp-shop" onClick={() => goProduct(featured.productSlug)}>
              Lihat paket
            </button>

            {extras.length ? (
              <div className="fsp-more">
                {extras.map((item) => (
                  <button
                    key={item.saleId}
                    type="button"
                    className="fsp-moreChip"
                    onClick={() => goProduct(item.productSlug)}
                  >
                    {item.productName}
                    <em>-{item.discountPercent}%</em>
                  </button>
                ))}
              </div>
            ) : null}

            <div className="fsp-quiet">
              <button type="button" onClick={handleClose}>
                Nanti
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.setItem(SUPPRESS_DATE_KEY, getTodayString());
                  } catch {}
                  markSessionDone();
                  setSessionDismissed(true);
                  setIsSuppressed(true);
                  setIsOpen(false);
                }}
              >
                Jangan tampilkan hari ini
              </button>
            </div>
          </div>
        </article>
      </div>
    </div>,
    document.body
  );
}
