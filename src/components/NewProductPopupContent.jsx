import React from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { formatIDR } from "../lib/format";
import { resolvePromotionCopy } from "../lib/storefrontPromotions";
import BannerGraphic from "./BannerGraphic";
import "./NewProductPopup.css";

export default function NewProductPopupContent({ config, product, onNavigate, onSuppress, preview = false, titleId }) {
  const copy = resolvePromotionCopy(config, product);
  return <>
    <div className="np-popup-header">
      <span className="np-popup-badge"><Sparkles size={12}/>{copy.badge}</span>
      <BannerGraphic name={config?.graphic || "sparkle_celebration"} height={26} className="np-popup-mascot" />
    </div>
    <div className="np-popup-body">
      <div className="np-popup-iconWrap">
        {product?.icon_url ? <img src={product.icon_url} alt={product.name} className="np-popup-iconImg"/> : <Sparkles size={32}/>}
      </div>
      <div className="np-popup-copy">
        <h2 id={titleId} className="np-popup-title">{copy.title}</h2>
        <p className="np-popup-desc">{copy.description}</p>
        {copy.price > 0 && <div className="np-popup-priceRow"><span className="np-popup-priceLabel">Mulai dari</span><span className="np-popup-priceValue">{formatIDR(copy.price)}</span></div>}
      </div>
    </div>
    <div className="np-popup-actions">
      {preview ? <span className="np-popup-btnPrimary">{copy.button}<ArrowRight size={16}/></span> : <button type="button" className="np-popup-btnPrimary" onClick={onNavigate}>{copy.button}<ArrowRight size={16}/></button>}
      {preview ? <span className="np-popup-btnMuted">Jangan tampilkan lagi hari ini</span> : <button type="button" className="np-popup-btnMuted" onClick={onSuppress}>Jangan tampilkan lagi hari ini</button>}
    </div>
  </>;
}
