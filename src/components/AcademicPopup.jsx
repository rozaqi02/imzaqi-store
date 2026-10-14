import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useStorefrontOverlayBlocked } from "../hooks/useFunnelRoute";
import { X } from "lucide-react";
import { fetchProducts, fetchSettings } from "../lib/api";
import { isAcademicProduct } from "../lib/productCategories";
import { formatIDR, getCatalogPriceRange, summarizeCatalogCopy } from "../lib/format";
import { useDialogA11y } from "../hooks/useDialogA11y";
import useOverlaySlot from "../hooks/useOverlaySlot";
import BannerGraphic from "./BannerGraphic";

const SUPPRESS_DATE_KEY = "imzaqi_academic_suppress_date_v1";
const SESSION_DONE_KEY = "imzaqi_academic_popup_done";

function getTodayString() {
  return new Date().toDateString();
}

function notifyAcademicPopupClosed() {
  try {
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
  const overlayBlocked = useStorefrontOverlayBlocked();
  const [sessionDismissed, setSessionDismissed] = useState(wasHandledThisSession);
  const [warmedUp, setWarmedUp] = useState(false);
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

  const modalRef = useRef(null);

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

  // 2. Kelayakan tampil. Scheduler terpusat yang menggilir overlay, jadi popup ini
  //    tidak lagi mengumumkan diri lewat window.__imzaqi_academic_popup_active
  //    maupun memeriksa DOM popup lain. Rute sensitif ditangani overlayBlocked.
  const eligible = Boolean(
    !overlayBlocked &&
    settingsReady &&
    isEnabled &&
    !isSuppressed &&
    !sessionDismissed &&
    academicItems.length > 0
  );

  // Jeda 1.5s sebelum ikut antrean agar tidak menyambar slot saat render awal.
  useEffect(() => {
    if (!eligible) {
      setWarmedUp(false);
      return undefined;
    }
    const timer = setTimeout(() => setWarmedUp(true), 1500);
    return () => clearTimeout(timer);
  }, [eligible]);

  // Slot eksklusif: otomatis dilepas saat ditutup / unmount / pindah rute sensitif.
  const isOpen = useOverlaySlot("academicPopup", { ready: eligible && warmedUp });

  // 3. Lock scroll when open
  useEffect(() => {
    if (!isOpen) return undefined;
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [isOpen]);

  // Menutup = membuat popup tidak eligible lagi sehingga scheduler melepas slot
  // dan popup berikutnya di antrean boleh naik.
  const handleClose = () => {
    setSessionDismissed(true);
    notifyAcademicPopupClosed();
  };

  const handleSuppressToday = () => {
    try {
      localStorage.setItem(SUPPRESS_DATE_KEY, getTodayString());
      setIsSuppressed(true);
    } catch (e) {
      console.warn("Gagal menyimpan preferensi pop-up:", e);
    }
    setSessionDismissed(true);
    notifyAcademicPopupClosed();
  };

  const goProduct = (slug) => {
    setSessionDismissed(true);
    notifyAcademicPopupClosed();
    navigate(`/produk/${slug}`);
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
            <p className="ac-label">
              <BannerGraphic name="academic_grad" height={22} className="ac-mascot" />
              <span>Jasa akademik</span>
            </p>
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
