import React, { useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import { useFunnelRoute } from "../hooks/useFunnelRoute";
import { BellOff, Clock, X } from "lucide-react";
import { fetchActiveFlashSales, fetchProducts } from "../lib/api";
import { formatIDR } from "../lib/format";
import { OVERLAY_TIMING } from "../lib/overlayScheduler";
import { useDialogA11y } from "../hooks/useDialogA11y";

// Note: no Flame icon in title (user preference)
const SUPPRESS_DATE_KEY = "imzaqi_flash_sale_suppress_date_v1";

function getTodayString() {
  return new Date().toDateString();
}

export default function FlashSalePopup() {
  const navigate = useNavigate();
  const location = useLocation();
  const isFunnel = useFunnelRoute();
  const [isOpen, setIsOpen] = useState(false);
  const [salesItems, setSalesItems] = useState([]);
  const [closestEndTime, setClosestEndTime] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [isSuppressed, setIsSuppressed] = useState(() => {
    try {
      return localStorage.getItem(SUPPRESS_DATE_KEY) === getTodayString();
    } catch {
      return false;
    }
  });

  const prevPathnameRef = useRef(location.pathname);
  const modalRef = useRef(null);

  // 1. Fetch active flash sales and enrich with product/variant info
  useEffect(() => {
    let active = true;

    async function loadPromoData() {
      try {
        const [flashSales, products] = await Promise.all([
          fetchActiveFlashSales({ useCache: true }),
          fetchProducts({ includeInactive: false })
        ]);

        if (!active) return;
        if (!flashSales || !flashSales.length || !products || !products.length) return;

        // Padukan data flash sale dengan data produk & variannya
        const enriched = [];
        let minEndTime = null;

        flashSales.forEach((sale) => {
          for (const product of products) {
            const variant = (product.product_variants || []).find(
              (v) => v.id === sale.variant_id
            );

            if (variant && variant.is_active) {
              const promoPrice = Math.round(
                variant.price_idr * (1 - sale.discount_percent / 100)
              );

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
                endsAt: sale.ends_at
              });

              const saleEndTime = new Date(sale.ends_at).getTime();
              if (!minEndTime || saleEndTime < minEndTime) {
                minEndTime = saleEndTime;
              }
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

  // 2. Jangan menumpuk dua modal promosi dalam satu kunjungan.
  useEffect(() => {
    const suppressedToday = localStorage.getItem(SUPPRESS_DATE_KEY) === getTodayString();
    if (suppressedToday || isFunnel || salesItems.length === 0) return;

    const checkAndOpenFlashSale = () => {
      const isAcademicActive = Boolean(
        window.__imzaqi_academic_popup_active ||
        document.querySelector(".ac-popup-backdrop")
      );

      // Bila akademik sedang tampil, flash sale tidak menyela setelahnya.
      if (isAcademicActive) return;

      setIsOpen(true);
    };

    const initialTimer = setTimeout(checkAndOpenFlashSale, OVERLAY_TIMING.flashSaleMs);

    return () => {
      clearTimeout(initialTimer);
    };
  }, [isFunnel, salesItems.length]);

  // 3. Countdown Timer
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

  const handleToggleSuppress = (e) => {
    const checked = e.target.checked;
    setIsSuppressed(checked);
    if (checked) {
      localStorage.setItem(SUPPRESS_DATE_KEY, getTodayString());
      setIsOpen(false);
    } else {
      localStorage.removeItem(SUPPRESS_DATE_KEY);
    }
  };

  const isAcademicActive = Boolean(
    window.__imzaqi_academic_popup_active ||
    (typeof document !== "undefined" && document.querySelector(".ac-popup-backdrop"))
  );

  const handleClose = () => setIsOpen(false);

  useDialogA11y({
    open: isOpen,
    containerRef: modalRef,
    onClose: handleClose,
    initialFocusSelector: ".fsp-closeBtn",
  });

  if (isFunnel || !isOpen || salesItems.length === 0 || isAcademicActive) return null;

  return createPortal(
    <div
      className="fsp-backdrop"
      onMouseDown={handleClose}
      role="presentation"
    >
      <div
        ref={modalRef}
        className="fsp-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="flash-sale-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Head */}
        <div className="fsp-head">
          <div className="fsp-titleBlock">
            <h2 id="flash-sale-title" className="fsp-kicker">
              <span>Flash Sale!</span>
            </h2>
            <p className="fsp-title">Lagi diskon lohh</p>
          </div>
          <button type="button" className="fsp-closeBtn" onClick={handleClose} aria-label="Tutup pop-up Flash Sale">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Body (List items on sale) */}
        <div className="fsp-body">
          {salesItems.map((item) => {
            const iconUrl = String(item.productIconUrl || "").trim();
            return (
              <div key={item.saleId} className="fsp-item">
                <div className="fsp-itemLeft">
                  <div className="fsp-itemIcon">
                    {iconUrl ? (
                      <img src={iconUrl} alt="" loading="lazy" />
                    ) : (
                      <span className="fsp-fallbackText">
                        {String(item.productName || "P").slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="fsp-itemInfo">
                    <div className="fsp-itemNameRow">
                      <span className="fsp-itemName">{item.productName}</span>
                      <span className="fsp-discountBadge">-{item.discountPercent}%</span>
                    </div>
                    <span className="fsp-itemMeta">
                      {item.variantName} • {item.durationLabel}
                    </span>
                  </div>
                </div>

                <div className="fsp-itemRight">
                  <div className="fsp-priceCol">
                    <span className="fsp-originalPrice">
                      {formatIDR(item.originalPrice)}
                    </span>
                    <span className="fsp-promoPrice">
                      {formatIDR(item.promoPrice)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="fsp-actionBtn"
                    onClick={() => {
                      setIsOpen(false);
                      navigate(`/produk/${item.productSlug}`);
                    }}
                  >
                    Beli
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Foot */}
        <div className="fsp-foot">
          {timeLeft && !timeLeft.expired ? (
            <div className="fsp-footTop">
              <div
                className="fsp-countdownWrap"
                aria-label={`Sisa ${Number(timeLeft.hours)} jam ${Number(timeLeft.minutes)} menit ${Number(timeLeft.seconds)} detik`}
              >
                <Clock size={12} aria-hidden="true" />
                <span className="fsp-countdownLabel">Promo berakhir</span>
                <div className="fsp-countdownUnits">
                  <span className="fsp-countdownUnit">
                    <strong className="fsp-countdownVal">{timeLeft.hours}</strong>
                    <small>jam</small>
                  </span>
                  <span className="fsp-countdownSep" aria-hidden="true">:</span>
                  <span className="fsp-countdownUnit">
                    <strong className="fsp-countdownVal">{timeLeft.minutes}</strong>
                    <small>menit</small>
                  </span>
                  <span className="fsp-countdownSep" aria-hidden="true">:</span>
                  <span className="fsp-countdownUnit is-sec">
                    <strong className="fsp-countdownVal">{timeLeft.seconds}</strong>
                    <small>detik</small>
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          <div className="fsp-footBottom">
            <button
              type="button"
              className="fsp-dontShowBtn fsp-btn-red"
              style={{
                backgroundColor: "#e11d3a",
                backgroundImage: "linear-gradient(165deg, #ff5a6a 0%, #e11d3a 50%, #be123c 100%)",
                color: "#fff",
                border: "1px solid #9f1239",
              }}
              onClick={() => {
                localStorage.setItem(SUPPRESS_DATE_KEY, getTodayString());
                setIsSuppressed(true);
                setIsOpen(false);
              }}
              title="Sembunyikan pemberitahuan flash sale ini sampai esok hari"
            >
              <BellOff size={13} strokeWidth={2.2} style={{ marginRight: 6, flexShrink: 0, color: "#fff" }} />
              Jangan Beritahu Lagi Hari Ini
            </button>
            <button
              type="button"
              className="fsp-closeTextLink"
              onClick={handleClose}
            >
              Nanti Aja
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
