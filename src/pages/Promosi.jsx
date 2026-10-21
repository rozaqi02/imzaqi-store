import React, { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { fetchProducts, fetchSettings } from "../lib/api";
import { usePageMeta } from "../hooks/usePageMeta";
import MarketingMediaGenerator from "./admin/components/MarketingMediaGenerator";
import "../css/pages/Promosi.css";

export default function Promosi() {
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);

  usePageMeta({
    title: "Media Promosi & Katalog",
    description: "Studio poster produk dan pricelist katalog imzaqi.store siap download dan bagikan.",
  });

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetchProducts({ includeInactive: false, useCache: true }),
      fetchSettings({ useCache: true }),
    ])
      .then(([prods, sets]) => {
        if (!alive) return;
        setProducts(Array.isArray(prods) ? prods : []);
        setSettings(sets || {});
      })
      .catch((err) => {
        console.error("Gagal memuat data promosi:", err);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="promosi-page">
      <div className="promosi-wrap">
        <header className="promosi-hero">
          <div className="promosi-heroCopy">
            <span className="promosi-eyebrow">
              <Sparkles size={16} /> STUDIO PROMOSI & RESELLER
            </span>
            <h1>Media Promosi<br /><span>& Katalog Resmi</span></h1>
            <p>
              Generator materi promosi, poster produk premium, dan katalog harga resmi Imzaqi Store.
              Bebas didownload atau disalin langsung untuk promosi status WhatsApp, Instagram, dan media sosial Anda.
            </p>
          </div>
        </header>

        <section className="promosi-studio" aria-label="Studio Media Promosi">
          {loading ? (
            <div className="promosi-loading" role="status" aria-live="polite">
              <div className="promosi-loadingSpinner" />
              <p>Menyiapkan data produk & katalog...</p>
            </div>
          ) : (
            <MarketingMediaGenerator products={products} settings={settings} />
          )}
        </section>
      </div>
    </div>
  );
}
