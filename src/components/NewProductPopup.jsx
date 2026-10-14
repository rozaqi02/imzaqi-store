import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { fetchProducts, fetchSettings } from "../lib/api";
import { normalizePromotion, promotionDestination } from "../lib/storefrontPromotions";
import { useStorefrontOverlayBlocked } from "../hooks/useFunnelRoute";
import { useDialogA11y } from "../hooks/useDialogA11y";
import useOverlaySlot from "../hooks/useOverlaySlot";
import NewProductPopupContent from "./NewProductPopupContent";

const SUPPRESS_DATE_KEY = "imzaqi_new_product_suppress_date_v1";
const SESSION_DONE_KEY = "imzaqi_new_product_popup_done";
const today = () => new Date().toDateString();
function wasHandled() {
  try { return sessionStorage.getItem(SESSION_DONE_KEY) === "true" || localStorage.getItem(SUPPRESS_DATE_KEY) === today(); }
  catch { return false; }
}

export default function NewProductPopup() {
  const navigate = useNavigate(), location = useLocation();
  const blocked = useStorefrontOverlayBlocked();
  const [config, setConfig] = useState(null), [product, setProduct] = useState(null);
  const [warmedUp, setWarmedUp] = useState(false);
  const [handled, setHandled] = useState(wasHandled);
  const modalRef = useRef(null);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchSettings({ useCache: true }), fetchProducts({ useCache: true })]).then(([settings, products]) => {
      if (!alive) return;
      const next = normalizePromotion("new_product_popup", settings.new_product_popup);
      const selected = products.find(p => String(p.id) === next.product_id && p.is_active !== false);
      if (next.enabled && selected) { setConfig(next); setProduct(selected); }
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // Kelayakan tampil: setting admin aktif, produk tersedia, belum ditangani,
  // rute sesuai, dan bukan rute sensitif (blocked).
  const eligible = Boolean(
    !blocked && config?.enabled && product && !handled && !wasHandled() &&
    !(config?.show_on === "home" && location.pathname !== "/")
  );

  // Jeda 1.8s sebelum ikut antrean agar tidak menyambar slot tepat saat render
  // awal. Menggantikan polling DOM 800ms lama: kini scheduler yang menggilir.
  useEffect(() => {
    if (!eligible) { setWarmedUp(false); return undefined; }
    const timer = setTimeout(() => setWarmedUp(true), 1800);
    return () => clearTimeout(timer);
  }, [eligible]);

  // Slot eksklusif dari scheduler terpusat: hanya satu overlay storefront
  // (flash sale / produk baru / akademik) yang boleh tampil pada satu waktu.
  const open = useOverlaySlot("newProductPopup", { ready: eligible && warmedUp });

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  const close = () => {
    try { sessionStorage.setItem(SESSION_DONE_KEY, "true"); } catch {}
    setHandled(true);
    window.dispatchEvent(new CustomEvent("imzaqi_new_product_popup_closed"));
  };
  const suppress = () => {
    try { localStorage.setItem(SUPPRESS_DATE_KEY, today()); } catch {}
    close();
  };
  const go = () => {
    const destination = promotionDestination(config.link, product);
    close();
    if (/^https?:\/\//i.test(destination)) window.location.assign(destination);
    else navigate(destination);
  };
  useDialogA11y({ open: open && !blocked, containerRef: modalRef, onClose: close, initialFocusSelector: ".np-popup-close" });
  if (!open || blocked || !config || !product) return null;

  return createPortal(<div className="np-popup-backdrop" onClick={close} role="presentation">
    <div className="np-popup-card" ref={modalRef} onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="np-popup-title">
      <button type="button" className="np-popup-close" aria-label="Tutup pop-up produk baru" onClick={close}><X size={18}/></button>
      <NewProductPopupContent config={config} product={product} onNavigate={go} onSuppress={suppress} titleId="np-popup-title"/>
    </div>
  </div>, document.body);
}
