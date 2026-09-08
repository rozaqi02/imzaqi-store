import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import { useStorefrontOverlayBlocked } from "../hooks/useFunnelRoute";
import { X } from "lucide-react";
import { fetchProducts, fetchSettings } from "../lib/api";
import { isAcademicProduct } from "../lib/productCategories";
import { formatIDR, getCatalogPriceRange, summarizeCatalogCopy } from "../lib/format";
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
  const overlayBlocked = useStorefrontOverlayBlocked();
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
            const minPrice = getCatalogPriceRange(variants).minPrice;
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
    if (overlayBlocked) {
      setIsOpen(false);
      try {
        window.__imzaqi_academic_popup_active = false;
      } catch {}
      return;
    }

    if (!settingsReady) {
      return;
    }

    if (isSuppressed || !isEnabled || wasHandledThisSession()) {
      notifyAcademicPopupClosed();
      return;
    }

    // Jangan tampilkan fallback generik saat katalog gagal dimuat.
    if (academicItems.length === 0) return undefined;

    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, [academicItems.length, isEnabled, overlayBlocked, isSuppressed, settingsReady]);

  useEffect(() => {
    if (!overlayBlocked) return;
    setIsOpen(false);
    try {
      window.__imzaqi_academic_popup_active = false;
    } catch {}
  }, [overlayBlocked]);

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
    open: isOpen && !overlayBlocked,
    containerRef: modalRef,
    onClose: handleClose,
    initialFocusSelector: ".ac-popup-closeFloat",
  });

  if (
    overlayBlocked ||
    !isOpen ||
    !settingsReady ||
    !isEnabled ||
    isSuppressed ||
    academicItems.length === 0
  ) {
    return null;
  }

  const featured = academicItems[0];
  const extras = academicItems.slice(1, 4);
  const featuredIcon = String(featured?.iconUrl || "").trim();

  function goProduct(slug) {
    setIsOpen(false);
    notifyAcademicPopupClosed();
    navigate(`/produk/${slug}`);
  }

  return createPortal(
    <div className="ac-popup-backdrop" onMouseDown={handleClose} role="presentation">
      <div
        ref={modalRef}
        className="ac-popup-stage"
        role="dialog"
        aria-modal="true"
        aria-labelledby="academic-popup-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button type="button" className="ac-popup-closeFloat" onClick={handleClose} aria-label="Tutup">
          <X size={18} aria-hidden="true" />
        </button>

        <article className="ac-billboard">
          <div className="ac-visual">
            <div className="ac-visualIcon">
              {featuredIcon ? (
                <img src={featuredIcon} alt="" />
              ) : (
                <span>{String(featured.name || "A").slice(0, 1).toUpperCase()}</span>
              )}
            </div>
          </div>
          <div className="ac-copy">
            <p className="ac-label">Jasa akademik</p>
            <h2 id="academic-popup-title" className="ac-headline">{featured.name}</h2>
            <p className="ac-meta">Mulai {featured.formattedPrice}</p>
            <button type="button" className="ac-shop" onClick={() => goProduct(featured.slug)}>
              Lihat paket
            </button>
            {extras.length ? (
              <div className="ac-more">
                {extras.map((item) => (
                  <button key={item.id || item.slug} type="button" className="ac-moreChip" onClick={() => goProduct(item.slug)}>
                    {item.name}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="ac-quiet">
              <button type="button" onClick={handleClose}>Nanti</button>
              <button type="button" onClick={handleSuppressToday}>Jangan tampilkan hari ini</button>
            </div>
          </div>
        </article>
      </div>
    </div>,
    document.body
  );
}
