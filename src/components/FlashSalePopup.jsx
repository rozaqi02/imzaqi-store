import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Clock, Flame, X } from "lucide-react";
import { fetchActiveFlashSales, fetchProducts } from "../lib/api";
import { formatIDR } from "../lib/format";
import "./FlashSalePopup.css";

const POPUP_STORAGE_KEY = "imzaqi_flash_sale_popup_shown_v2";

export default function FlashSalePopup() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [salesItems, setSalesItems] = useState([]);
  const [closestEndTime, setClosestEndTime] = useState(null);
  const [timeLeft, setTimeLeft] = useState("");

  // 1. Fetch active flash sales and enrich with product/variant info
  useEffect(() => {
    let active = true;

    async function loadPromoData() {
      try {
        // Cek dulu apakah di session ini pop-up sudah pernah ditampilkan
        const isShown = sessionStorage.getItem(POPUP_STORAGE_KEY);
        if (isShown) return;

        const [flashSales, products] = await Promise.all([
          fetchActiveFlashSales({ useCache: true }),
          fetchProducts({ includeInactive: false })
        ]);

        if (!active) return;
        if (!flashSales.length || !products.length) return;

        // Padukan data flash sale dengan data produk & variannya
        const enriched = [];
        let minEndTime = null;

        flashSales.forEach((sale) => {
          // Cari variant yang cocok di semua produk
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

              // Cari waktu berakhir terdekat
              const saleEndTime = new Date(sale.ends_at).getTime();
              if (!minEndTime || saleEndTime < minEndTime) {
                minEndTime = saleEndTime;
              }
              break; // Variant sudah ketemu, lanjut ke sale berikutnya
            }
          }
        });

        if (enriched.length > 0) {
          setSalesItems(enriched);
          setClosestEndTime(minEndTime);
          setIsOpen(true);
          sessionStorage.setItem(POPUP_STORAGE_KEY, "1");
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

  // 2. Countdown Timer
  useEffect(() => {
    if (!isOpen || !closestEndTime) return undefined;

    function updateTimer() {
      const now = Date.now();
      const diff = closestEndTime - now;

      if (diff <= 0) {
        setTimeLeft("Berakhir!");
        setIsOpen(false); // Otomatis tutup jika flash sale berakhir
        return;
      }

      const hours = String(Math.floor(diff / 3600000)).padStart(2, "0");
      const minutes = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
      const seconds = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");

      setTimeLeft(`${hours}:${minutes}:${seconds}`);
    }

    updateTimer(); // Jalankan sekali di awal
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isOpen, closestEndTime]);

  if (!isOpen || salesItems.length === 0) return null;

  return createPortal(
    <div
      className="fsp-backdrop"
      onMouseDown={() => setIsOpen(false)}
      role="presentation"
    >
      <div
        className="fsp-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Flash Sale Aktif"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Head */}
        <div className="fsp-head">
          <div className="fsp-titleBlock">
            <span className="fsp-kicker">
              <Flame size={10} fill="#ff3b30" />
              <span>Flash Sale Aktif</span>
            </span>
            <h2 className="fsp-title">Lagi Diskon Gede!</h2>
          </div>
          <button
            className="fsp-closeBtn"
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Tutup"
          >
            <X size={16} />
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
                    <span className="fsp-itemName">{item.productName}</span>
                    <span className="fsp-itemMeta">
                      {item.variantName} / {item.durationLabel}
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
          {timeLeft && (
            <div className="fsp-countdownWrap">
              <Clock size={12} />
              <span>Berakhir:</span>
              <span className="fsp-countdownVal">{timeLeft}</span>
            </div>
          )}
          <button
            type="button"
            className="fsp-closeTextLink"
            onClick={() => setIsOpen(false)}
          >
            Nanti Aja
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
