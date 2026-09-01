import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import { useFunnelRoute } from "../hooks/useFunnelRoute";
import { BellOff, ShieldCheck, CheckCircle2, X } from "lucide-react";
import { fetchProducts, fetchSettings } from "../lib/api";
import { isAcademicProduct } from "../lib/productCategories";
import { formatIDR, summarizeCatalogCopy } from "../lib/format";
import { useDialogA11y } from "../hooks/useDialogA11y";

const SUPPRESS_DATE_KEY = "imzaqi_academic_suppress_date_v1";
const SESSION_DONE_KEY = "imzaqi_academic_popup_done";

function getTodayString() {
  return new Date().toDateString();
}

function notifyAcademicPopupClosed() {
  try {
    window.__imzaqi_academic_popup_active = false;
    sessionStorage.setItem(SESSION_DONE_KEY, "true");
    window.dispatchEvent(new CustomEvent("imzaqi_academic_popup_closed"));
  } catch {}
}

function wasHandledThisSession() {
  try {
    return sessionStorage.getItem(SESSION_DONE_KEY) === "true";
  } catch {
    return false;
  }
}

export default function AcademicPopup() {
  const navigate = useNavigate();
  const location = useLocation();
  const isFunnel = useFunnelRoute();
  const [isOpen, setIsOpen] = useState(false);
  const [academicItems, setAcademicItems] = useState([]);
  // Default aman: pop-up tidak boleh muncul sebelum setting admin berhasil dibaca.
  const [isEnabled, setIsEnabled] = useState(false);
  const [settingsReady, setSettingsReady] = useState(false);
  const [isSuppressed, setIsSuppressed] = useState(() => {
    try {
      return localStorage.getItem(SUPPRESS_DATE_KEY) === getTodayString();
    } catch {
      return false;
    }
  });

  const prevPathnameRef = useRef(location.pathname);
  const modalRef = useRef(null);

  // Sync global active status flag
  useEffect(() => {
    if (isOpen) {
      window.__imzaqi_academic_popup_active = true;
    } else {
      window.__imzaqi_academic_popup_active = false;
    }
    return () => {
      window.__imzaqi_academic_popup_active = false;
    };
  }, [isOpen]);

  // 1. Fetch admin setting & products
  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const [settings, products] = await Promise.all([
          fetchSettings({ useCache: true }).catch(() => ({})),
          fetchProducts({ useCache: true }).catch(() => []),
        ]);

        if (!active) return;

        // Check if enabled from admin settings
        const acSetting = settings?.academic_popup;
        // Hanya aktif bila admin secara eksplisit menyimpan nilai true.
        const enabledSetting = Boolean(
          acSetting && typeof acSetting === "object" && acSetting.enabled === true
        );
        setIsEnabled(enabledSetting);

        if (products && products.length > 0) {
          const filtered = products.filter((p) => isAcademicProduct(p) && p.is_active !== false);
          const mapped = filtered.map((product) => {
            const variants = (product.product_variants || []).filter((v) => v.is_active !== false);
            const prices = variants.map((v) => Number(v.price_idr || 0)).filter((n) => n > 0);
            const minPrice = prices.length ? Math.min(...prices) : 0;
            return {
              id: product.id,
              name: product.name,
              slug: product.slug,
              iconUrl: product.icon_url,
              summary: summarizeCatalogCopy(product.description),
              minPrice,
              formattedPrice: minPrice ? formatIDR(minPrice) : "-",
            };
          });

          if (active) {
            setAcademicItems(mapped);
          }
        }
      } catch (err) {
        console.warn("[AcademicPopup] Gagal memuat data:", err);
      } finally {
        if (active) setSettingsReady(true);
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, []);

  // 2. Schedule only after the persisted admin setting and product data are ready.
  useEffect(() => {
    if (!settingsReady || isSuppressed || !isEnabled || isFunnel || wasHandledThisSession()) {
      notifyAcademicPopupClosed();
      return;
    }

    // Jangan tampilkan fallback generik saat katalog gagal dimuat.
    if (academicItems.length === 0) return undefined;

    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, [academicItems.length, isEnabled, isFunnel, isSuppressed, settingsReady]);

  // 3. Lock scroll when open
  useEffect(() => {
    if (!isOpen) return;
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [isOpen]);

  // 4. Handle route changes
  useEffect(() => {
    if (prevPathnameRef.current !== location.pathname) {
      prevPathnameRef.current = location.pathname;
      if (isOpen) {
        setIsOpen(false);
        notifyAcademicPopupClosed();
      }
    }
  }, [location.pathname, isOpen]);

  const handleClose = () => {
    setIsOpen(false);
    notifyAcademicPopupClosed();
  };

  const handleSuppressToday = () => {
    try {
      localStorage.setItem(SUPPRESS_DATE_KEY, getTodayString());
      setIsSuppressed(true);
    } catch (e) {
      console.warn("Gagal menyimpan preferensi pop-up:", e);
    }
    setIsOpen(false);
    notifyAcademicPopupClosed();
  };

  useDialogA11y({
    open: isOpen,
    containerRef: modalRef,
    onClose: handleClose,
    initialFocusSelector: ".ac-popup-closeBtn",
  });

  if (!isOpen || !settingsReady || !isEnabled || isSuppressed || isFunnel || academicItems.length === 0) return null;

  return createPortal(
    <div
      className="ac-popup-backdrop"
      onMouseDown={handleClose}
      role="presentation"
    >
      <div
        ref={modalRef}
        className="ac-popup-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="academic-popup-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Head */}
        <div className="ac-popup-head">
          <div className="ac-popup-titleBlock">
            <h2 id="academic-popup-title" className="ac-popup-kicker">
              <span>Jasa Akademik</span>
            </h2>
            <p className="ac-popup-sub">
              Semua layanan akademik dikerjakan cepat, akurat, aman no repo, dan harga mahasiswa!
            </p>
          </div>
          <button type="button" className="ac-popup-closeBtn" onClick={handleClose} aria-label="Tutup pop-up Jasa Akademik">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="ac-popup-body">
          {academicItems.map((item) => {
            const iconUrl = String(item.iconUrl || "").trim();
            return (
              <div key={item.id || item.slug} className="ac-popup-item">
                <div className="ac-popup-itemMain">
                  <div className="ac-popup-itemIcon">
                    {iconUrl ? (
                      <img src={iconUrl} alt={item.name} loading="lazy" />
                    ) : (
                      <span className="ac-popup-fallbackText">
                        {String(item.name || "A").slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="ac-popup-itemContent">
                    <h3 className="ac-popup-itemName">{item.name}</h3>
                  </div>
                </div>

                <div className="ac-popup-itemFooter">
                  <span className="ac-popup-itemPrice">
                    Mulai {item.formattedPrice}
                  </span>
                  <button
                    type="button"
                    className="ac-popup-actionBtn"
                    onClick={() => {
                      setIsOpen(false);
                      notifyAcademicPopupClosed();
                      navigate(`/produk/${item.slug}`);
                    }}
                  >
                    Pesan
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Foot */}
        <div className="ac-popup-foot">
          {/* Trust Bar */}
          <div className="ac-popup-trustBar">
            <span>
              <ShieldCheck size={13} /> Garansi Kerahasiaan File
            </span>
            <span>
              <CheckCircle2 size={13} /> Pengerjaan Cepat
            </span>
          </div>

          {/* Bottom Actions */}
          <div className="ac-popup-actions">
            <button
              type="button"
              className="ac-popup-suppressBtn"
              onClick={handleSuppressToday}
              title="Sembunyikan pemberitahuan ini sampai esok hari"
            >
              <BellOff size={13} strokeWidth={2.2} />
              <span>Jangan ingatkan hari ini</span>
            </button>
            <button
              type="button"
              className="ac-popup-laterBtn"
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
