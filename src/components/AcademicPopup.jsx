import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import { useFunnelRoute } from "../hooks/useFunnelRoute";
import { BellOff, ShieldCheck, CheckCircle2 } from "lucide-react";
import { fetchProducts, fetchSettings } from "../lib/api";
import { isAcademicProduct } from "../lib/productCategories";
import { formatIDR, summarizeCatalogCopy } from "../lib/format";
import "./AcademicPopup.css";

const SUPPRESS_DATE_KEY = "imzaqi_academic_suppress_date_v1";

function getTodayString() {
  return new Date().toDateString();
}

function notifyAcademicPopupClosed() {
  try {
    window.__imzaqi_academic_popup_active = false;
    sessionStorage.setItem("imzaqi_academic_popup_done", "true");
    window.dispatchEvent(new CustomEvent("imzaqi_academic_popup_closed"));
  } catch {}
}

export default function AcademicPopup() {
  const navigate = useNavigate();
  const location = useLocation();
  const isFunnel = useFunnelRoute();
  const [isOpen, setIsOpen] = useState(false);
  const [academicItems, setAcademicItems] = useState([]);
  const [isEnabled, setIsEnabled] = useState(true);
  const [isSuppressed, setIsSuppressed] = useState(() => {
    try {
      return localStorage.getItem(SUPPRESS_DATE_KEY) === getTodayString();
    } catch {
      return false;
    }
  });

  const prevPathnameRef = useRef(location.pathname);

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
        const enabledSetting = !(acSetting && typeof acSetting === "object" && acSetting.enabled === false);
        setIsEnabled(enabledSetting);

        if (!enabledSetting) {
          notifyAcademicPopupClosed();
        }

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
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, []);

  // 2. Schedule Academic Popup opening (opens FIRST after 1.5s)
  useEffect(() => {
    const suppressedToday = localStorage.getItem(SUPPRESS_DATE_KEY) === getTodayString();
    if (suppressedToday || !isEnabled || isFunnel) {
      notifyAcademicPopupClosed();
      return;
    }

    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, [isFunnel, isEnabled]);

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

  if (!isOpen || !isEnabled || isSuppressed || isFunnel) return null;

  const displayItems = academicItems.length > 0 ? academicItems : [
    {
      id: "f1",
      name: "Jasa Parafrase",
      slug: "jasa-parafrase",
      iconUrl: "/icon-jasa-parafrase.jpg",
      summary: "Turunkan skor Turnitin & rapikan kalimat",
      formattedPrice: "Rp 2.500",
    },
    {
      id: "f2",
      name: "Cek AI ZeroGPT",
      slug: "cek-ai-zerogpt",
      iconUrl: "/icon-cek-ai-zerogpt.jpg",
      summary: "Deteksi teks AI, akurat & laporan lengkap",
      formattedPrice: "Rp 9.000",
    },
    {
      id: "f3",
      name: "Cek Plagiasi Turnitin No Repository",
      slug: "cek-plagiasi-turnitin",
      iconUrl: "/icon-cek-turnitin.jpg",
      summary: "No Repository — dokumen 100% aman!",
      formattedPrice: "Rp 7.000",
    },
    {
      id: "f4",
      name: "Jasa Mendeley",
      slug: "jasa-mendeley",
      iconUrl: "/icon-jasa-mendeley.jpg",
      summary: "Sitasi & daftar pustaka otomatis rapi",
      formattedPrice: "Rp 1.000",
    },
  ];

  return createPortal(
    <div
      className="ac-popup-backdrop"
      onMouseDown={handleClose}
      role="presentation"
    >
      <div
        className="ac-popup-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Jasa Akademik"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Head */}
        <div className="ac-popup-head">
          <div className="ac-popup-titleBlock">
            <h2 className="ac-popup-kicker">
              <span>Jasa Akademik</span>
            </h2>
            <p className="ac-popup-sub">
              Semua layanan akademik dikerjakan cepat, akurat, aman no repo, dan harga mahasiswa!
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="ac-popup-body">
          {displayItems.map((item) => {
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
