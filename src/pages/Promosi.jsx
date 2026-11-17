import React, { useEffect, useState } from "react";
import {
  Layers,
  Image as ImageIcon,
  CheckCircle2,
  Palette,
  Megaphone,
} from "lucide-react";
import { fetchProducts, fetchSettings } from "../lib/api";
import { usePageMeta } from "../hooks/usePageMeta";
import MarketingMediaGenerator from "./admin/components/MarketingMediaGenerator";
import "../css/pages/Promosi.css";

export default function Promosi() {
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);

  usePageMeta({
    title: "Studio Promosi & Katalog Resmi",
    description: "Studio materi promosi, poster produk premium, dan katalog harga resmi Imzaqi Store siap unduh kualitas HD.",
  });

  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      fetchProducts({ includeInactive: false, useCache: true }),
      fetchSettings({ useCache: true }),
    ])
      .then(([prodsRes, setsRes]) => {
        if (!alive) return;
        if (prodsRes.status === "fulfilled" && Array.isArray(prodsRes.value)) {
          setProducts(prodsRes.value);
        }
        if (setsRes.status === "fulfilled" && setsRes.value) {
          setSettings(setsRes.value);
        }
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
        <header className="store-hero store-hero--promosi">
          <div className="store-heroCopy">
            <span className="store-heroEyebrow">
              <Megaphone size={13} aria-hidden="true" />
              <span>STUDIO PROMOSI &amp; RESELLER</span>
            </span>
            <h1>
              Bikin Materi Promosi <span>Hitungan Detik.</span>
            </h1>
            <p>
              Poster produk HD &amp; pricelist katalog siap unduh untuk status WhatsApp, Instagram, dan Telegram.
            </p>
            <div className="store-heroFacts" aria-label="Ringkasan studio promosi">
              <span>
                <Layers size={13} aria-hidden="true" />
                <strong>{loading ? "…" : products.length}</strong> produk aktif
              </span>
              <span>
                <ImageIcon size={13} aria-hidden="true" />
                <strong>1:1, 9:16 &amp; 16:9</strong> HD
              </span>
              <span>
                <CheckCircle2 size={13} aria-hidden="true" />
                <strong>100% Gratis</strong> siap bagikan
              </span>
            </div>
          </div>

          <div className="store-statusArt store-statusArt--promosi">
            <span className="store-artLabel">PANDUAN 3 LANGKAH STUDIO</span>
            <ol className="promosi-quickSteps">
              <li>
                <span className="promosi-quickNum">01</span>
                <div>
                  <strong>Pilih Mode Materi</strong>
                  <small>Poster satuan atau pricelist</small>
                </div>
              </li>
              <li>
                <span className="promosi-quickNum">02</span>
                <div>
                  <strong>Kustomisasi Desain</strong>
                  <small>Tema, ukuran &amp; harga reseller</small>
                </div>
              </li>
              <li>
                <span className="promosi-quickNum">03</span>
                <div>
                  <strong>Unduh &amp; Bagikan</strong>
                  <small>PNG HD &amp; QR WhatsApp instan</small>
                </div>
              </li>
            </ol>
          </div>
        </header>

        <section className="promosi-studio" aria-label="Studio Media Promosi">
          <div className="promosi-studioHeader">
            <div className="promosi-studioTitleGroup">
              <span className="promosi-studioKicker">
                <Palette size={13} aria-hidden="true" />
                <span>PRATINJAU REALTIME</span>
              </span>
              <h2>Kustomisasi Materi Promosi</h2>
            </div>
          </div>

          {loading ? (
            <div className="promosi-loading" role="status" aria-live="polite">
              <div className="promosi-loadingSpinner" />
              <p>Menyiapkan data produk &amp; katalog resmi...</p>
            </div>
          ) : (
            <MarketingMediaGenerator products={products} settings={settings} />
          )}
        </section>
      </div>
    </div>
  );
}
