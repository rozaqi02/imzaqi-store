import React, { useEffect, useState } from "react";
import {
  Sparkles,
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
              <Megaphone size={14} />
              STUDIO PROMOSI & RESELLER
            </span>
            <h1>
              Bikin Materi Promosi <br />
              <span>Hitungan Detik.</span>
            </h1>
            <p>
              Generator poster produk premium, pricelist katalog harga resmi, dan materi promosi siap unduh resolusi tinggi untuk status WhatsApp, Instagram, dan media sosial Anda.
            </p>
            <div className="store-heroFacts" aria-label="Ringkasan studio promosi">
              <span>
                <Layers size={13} />
                <strong>{loading ? "…" : products.length}</strong> produk aktif
              </span>
              <span>
                <ImageIcon size={13} />
                <strong>Square & Story</strong> format HD
              </span>
              <span>
                <CheckCircle2 size={13} />
                <strong>100% Gratis</strong> siap bagikan
              </span>
            </div>
          </div>

          <div className="store-statusArt store-statusArt--promosi">
            <span className="store-artLabel">PANDUAN 3 LANGKAH STUDIO</span>
            <ol className="store-guideSteps">
              <li>
                <span className="store-guideNumber">01</span>
                <div>
                  <strong>Pilih Mode Materi</strong>
                  <span>Poster satuan produk atau pricelist katalog lengkap.</span>
                </div>
              </li>
              <li>
                <span className="store-guideNumber">02</span>
                <div>
                  <strong>Kustomisasi Desain</strong>
                  <span>Atur tema warna, diskon aktif, dan margin reseller.</span>
                </div>
              </li>
              <li>
                <span className="store-guideNumber">03</span>
                <div>
                  <strong>Unduh & Bagikan</strong>
                  <span>Simpan PNG resolusi HD atau salin teks promosi instan.</span>
                </div>
              </li>
            </ol>
            <div className="store-statusTip">
              <Palette size={14} />
              <span>Kanvas HD otomatis memuat QR WhatsApp resmi pesanan Anda.</span>
            </div>
          </div>
        </header>

        <section className="promosi-studio" aria-label="Studio Media Promosi">
          <div className="promosi-studioHeader">
            <div className="promosi-studioTitleGroup">
              <span className="promosi-studioKicker">
                <Sparkles size={13} /> KANVAS DESAIN & PRATINJAU REALTIME
              </span>
              <h2>Kustomisasi Materi Promosi</h2>
              <p>Pilih mode pembuatan di bawah ini, lalu sesuaikan format, warna, dan unduh materinya.</p>
            </div>
          </div>

          {loading ? (
            <div className="promosi-loading" role="status" aria-live="polite">
              <div className="promosi-loadingSpinner" />
              <p>Menyiapkan data produk & katalog resmi...</p>
            </div>
          ) : (
            <MarketingMediaGenerator products={products} settings={settings} />
          )}
        </section>
      </div>
    </div>
  );
}
