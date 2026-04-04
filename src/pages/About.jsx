import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronDown,
  CreditCard,
  ShieldCheck,
  Sparkles,
  Workflow,
  Zap,
} from "lucide-react";
import { fetchProducts, fetchSettings, fetchTestimonials } from "../lib/api";
import { usePageMeta } from "../hooks/usePageMeta";
import { buildStoreInsights } from "../lib/storeInsights";

export default function About() {
  usePageMeta({
    title: "Tentang",
    description: "Flow, nilai utama, dan FAQ Imzaqi Store.",
  });

  const [openIdx, setOpenIdx] = useState(0);
  const [products, setProducts] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [settings, setSettings] = useState({});

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const [nextProducts, nextTestimonials, nextSettings] = await Promise.all([
          fetchProducts(),
          fetchTestimonials(),
          fetchSettings(),
        ]);
        if (!alive) return;
        setProducts(nextProducts || []);
        setTestimonials(nextTestimonials || []);
        setSettings(nextSettings || {});
      } catch {}
    })();

    return () => {
      alive = false;
    };
  }, []);

  const insights = useMemo(
    () => buildStoreInsights({ products, testimonials, settings }),
    [products, settings, testimonials]
  );

  const values = useMemo(
    () => [
      {
        icon: Sparkles,
        title: "Ringkas",
        text: "Informasi inti tampil lebih dulu, jadi langkah berikutnya tidak perlu ditebak.",
      },
      {
        icon: ShieldCheck,
        title: "Jelas",
        text: "Harga, paket, catatan, dan status tetap terbaca di setiap tahap.",
      },
      {
        icon: Zap,
        title: "Nyambung",
        text: "Dari pilih produk sampai pantau order, alurnya tetap satu arah dan tidak ribut.",
      },
    ],
    []
  );

  const faq = useMemo(
    () => [
      {
        q: "Mulainya dari mana?",
        a: `Buka katalog dulu. Saat ini ada ${insights.productCount || "beberapa"} produk aktif, jadi paling enak mulai dari paket yang paling dekat dengan kebutuhanmu.`,
      },
      {
        q: "Setelah bayar, apa yang perlu disimpan?",
        a: "Simpan ID order. Halaman status selalu memakai ID itu sebagai acuan utama untuk progress dan catatan admin.",
      },
      {
        q: "Bagaimana soal garansi dan detail paket?",
        a: "Semua mengikuti varian yang dipilih. Detail penting tetap ditampilkan di halaman paket sebelum checkout.",
      },
      {
        q: "Kalau ada kendala?",
        a: insights.whatsappReady
          ? "Cek halaman status dulu, lalu hubungi admin lewat WhatsApp bila butuh bantuan lanjutan."
          : "Cek halaman status dulu. Jika butuh bantuan lanjutan, admin bisa dihubungi dari jalur bantuan yang tersedia.",
      },
    ],
    [insights.productCount, insights.whatsappReady]
  );

  const flow = useMemo(
    () => [
      {
        icon: Workflow,
        num: "01",
        title: "Pilih",
        text: "Cari produk lalu buka paket yang paling sesuai.",
      },
      {
        icon: CreditCard,
        num: "02",
        title: "Bayar",
        text: "Bayar via QRIS lalu simpan ID order.",
      },
      {
        icon: ShieldCheck,
        num: "03",
        title: "Pantau",
        text: "Buka halaman status kapan pun untuk lihat progres terbaru.",
      },
    ],
    []
  );

  return (
    <div className="page">
      <section className="section about-minimal-hero reveal">
        <div className="container center">
          <h1 className="h1 about-minimal-title">
            Alur beli yang singkat, bukan yang ribut.
          </h1>

          <p className="about-minimal-sub">Pilih paket, review order, bayar, lalu pantau status dengan tenang.</p>
          <p className="about-liveNote">
            {insights.productCount
              ? `Saat ini store menayangkan ${insights.productCount} produk aktif dan ${insights.testimonialsCount} bukti order yang bisa dipindai cepat.`
              : "Flow disusun supaya langkah penting tetap singkat dan mudah dilacak."}
          </p>

          <div className="about-miniStats">
            <div className="about-miniStat">
              <strong>{insights.productCount || "-"}</strong>
              <span>produk aktif</span>
            </div>
            <div className="about-miniStat">
              <strong>{insights.testimonialsCount || "-"}</strong>
              <span>bukti order</span>
            </div>
            <div className="about-miniStat">
              <strong>{insights.qrisReady ? "QRIS aktif" : "QRIS fallback"}</strong>
              <span>jalur bayar</span>
            </div>
            <div className="about-miniStat">
              <strong>{insights.whatsappReady ? "WA aktif" : "Support siap"}</strong>
              <span>bantuan lanjutan</span>
            </div>
          </div>

          <div className="about-miniCta">
            <Link className="btn" to="/produk">
              Lihat Produk
            </Link>
            <Link className="btn btn-ghost" to="/status">
              Cek Status
            </Link>
          </div>
        </div>
      </section>

      <section className="section reveal">
        <div className="container">
          <div className="about-valuesGrid">
            {values.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="about-valueCard card pad">
                  <span className="about-valueIcon">
                    <Icon size={18} />
                  </span>
                  <h2 className="h3">{item.title}</h2>
                  <p>{item.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section reveal">
        <div className="container">
          <div className="about-flowHead">
            <div className="about-sectionBadge">Flow</div>
            <h2 className="h2">Cara kerja</h2>
          </div>

          <div className="about-flowGrid">
            {flow.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.num} className="about-flowCard">
                  <div className="about-flowTop">
                    <span className="about-flowNum">{item.num}</span>
                    <span className="about-flowIcon">
                      <Icon size={18} />
                    </span>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section reveal">
        <div className="container">
          <div className="about-flowHead">
            <div className="about-sectionBadge">FAQ</div>
            <h2 className="h2">Singkat</h2>
          </div>

          <div className="about-faqStack">
            {faq.map((item, idx) => {
              const open = idx === openIdx;
              return (
                <button
                  key={item.q}
                  type="button"
                  className={`about-faqItem ${open ? "open" : ""}`}
                  onClick={() => setOpenIdx(open ? -1 : idx)}
                  aria-expanded={open}
                >
                  <div className="about-faqHead">
                    <span>{item.q}</span>
                    <ChevronDown size={16} />
                  </div>
                  {open ? <div className="about-faqBody">{item.a}</div> : null}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section reveal">
        <div className="container">
          <div className="about-finalCard card pad center">
            <div className="about-sectionBadge">Ready</div>
            <h2 className="h2">Lanjut ke langkah berikutnya</h2>
            <div className="about-miniCta">
              <Link className="btn" to="/produk">
                Belanja
              </Link>
              <Link className="btn btn-ghost" to="/testimoni">
                Testimoni
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
