import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { fetchProducts, fetchSettings } from "../lib/api";
import { normalizePromotion, promotionDestination } from "../lib/storefrontPromotions";
import { useStorefrontOverlayBlocked } from "../hooks/useFunnelRoute";
import { useDialogA11y } from "../hooks/useDialogA11y";
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
  const [open, setOpen] = useState(false), [config, setConfig] = useState(null), [product, setProduct] = useState(null);
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

  useEffect(() => {
    setOpen(false);
    if (blocked || !config?.enabled || !product || handled || wasHandled() || (config.show_on === "home" && location.pathname !== "/")) return;
    let timer;
    const tryOpen = () => {
      if (wasHandled()) return;
      // Wait for another storefront popup to close rather than stacking dialogs.
      if (document.querySelector(".ac-popup-backdrop, .fsp-backdrop") || window.__imzaqi_academic_popup_active) {
        timer = setTimeout(tryOpen, 800);
        return;
      }
      setOpen(true);
    };
    timer = setTimeout(tryOpen, 1800);
    return () => clearTimeout(timer);
  }, [blocked, config, product, handled, location.pathname]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  const close = () => {
    try { sessionStorage.setItem(SESSION_DONE_KEY, "true"); } catch {}
    setHandled(true); setOpen(false);
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
