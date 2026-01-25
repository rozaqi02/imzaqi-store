import React, { useMemo, useState } from "react";
import { formatIDR } from "../lib/format";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";

const LOGO_BY_SLUG = {
  netflix: "https://logo.clearbit.com/netflix.com",
  canva: "https://logo.clearbit.com/canva.com",
  "youtube-premium": "https://logo.clearbit.com/youtube.com",
  spotify: "https://logo.clearbit.com/spotify.com",
  "prime-video": "https://logo.clearbit.com/primevideo.com",
  "disney-hotstar": "https://logo.clearbit.com/hotstar.com",
  iqiyi: "https://logo.clearbit.com/iq.com",
  viu: "https://logo.clearbit.com/viu.com",
  vidio: "https://logo.clearbit.com/vidio.com",
  capcut: "https://logo.clearbit.com/capcut.com",
  "zoom-pro": "https://logo.clearbit.com/zoom.us",
  bstation: "https://logo.clearbit.com/bilibili.tv",
  getcontact: "https://logo.clearbit.com/getcontact.com",
  duolingo: "https://logo.clearbit.com/duolingo.com",
  "chatgpt-plus": "https://logo.clearbit.com/openai.com",
};

export default function ProductCard({ product }) {
  const { add } = useCart();
  const toast = useToast();
  const [imgError, setImgError] = useState(false);

  const variants = useMemo(
    () =>
      (product?.product_variants || [])
        .slice()
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    [product]
  );

  // prioritas: icon_url dari DB, kalau null pakai mapping slug
  const logoSrc = product?.icon_url || LOGO_BY_SLUG[product?.slug] || "";

  const fallbackLetter = (product?.name || "P").trim().slice(0, 1).toUpperCase();

  return (
    <div className="product-card">
      <div className="product-head">
        <div className="product-left">
          {logoSrc && !imgError ? (
            <img
              className="product-logo"
              src={logoSrc}
              alt={`${product.name} logo`}
              loading="lazy"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="product-logo-fallback" aria-hidden="true">
              {fallbackLetter}
            </div>
          )}

          <div className="product-title">
            <div className="product-name">{product.name}</div>
            <div className="product-desc">{product.description}</div>
          </div>
        </div>

        <div className="product-badge">Full Garansi*</div>
      </div>

      <div className="variant-list">
        {variants.map((v) => (
          <div key={v.id} className="variant-row">
            <div className="variant-meta">
              <div className="variant-name">{v.name}</div>
              <div className="variant-sub">
                {v.duration_label}
                {v.guarantee_text ? ` • ${v.guarantee_text}` : ""}
              </div>
            </div>
            <div className="variant-right">
              <div className="variant-price">{formatIDR(v.price_idr)}</div>
              <button
                className="btn btn-sm"
                onClick={() =>
                  (() => {
                    add(
                      {
                        ...v,
                        product_id: product.id,
                        product_name: product.name,
                      },
                      1
                    );
                    toast.success(`${v.name} • ${formatIDR(v.price_idr)}`, {
                      title: "Ditambahkan ke keranjang",
                      duration: 2200,
                    });
                  })()
                }
              >
                + Keranjang
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
