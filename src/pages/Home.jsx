import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  MessageCircle,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";

import Hero from "../components/Hero";
import HomeStickyBar from "../components/HomeStickyBar";
import ProductTile from "../components/ProductTile";
import { fetchProducts, fetchTopSellingIds, fetchPromoCodes, fetchSettings } from "../lib/api";
import EmptyState from "../components/EmptyState";
import { usePageMeta } from "../hooks/usePageMeta";
import { useRevealOnScroll } from "../hooks/useRevealOnScroll";
import { useToast } from "../context/ToastContext";
import { copyToClipboard } from "../utils/clipboard";

const HOME_FAQ = [
  {
    id: "home-pay",
    category: "Pembayaran",
    question: "Cara bayar di Imzaqi Store bagaimana?",
    answer: [
      "Pilih produk dan varian, lalu lanjut ke halaman bayar.",
      "Scan QRIS sesuai total yang tampil, lalu konfirmasi untuk membuat ID order.",
    ],
  },
  {
    id: "home-after-pay",
    category: "Order",
    question: "Setelah bayar, langkah selanjutnya apa?",
    answer: [
      "Simpan ID order yang muncul setelah konfirmasi pembayaran.",
      "Buka halaman Status dan masukkan ID untuk pantau progres terbaru.",
    ],
  },
  {
    id: "home-support",
    category: "Bantuan",
    question: "Kalau ada kendala, hubungi ke mana?",
    answer: [
      "Gunakan tombol Hubungi Admin dari halaman bayar atau status.",
      "Sertakan ID order agar pengecekan bisa langsung diproses.",
    ],
  },
];

const HOME_TESTIMONIALS = [
  {
    id: "t1",
    name: "Rizky A.",
    product: "Netflix Premium",
    text: "Prosesnya cepet banget, ga sampe 5 menit udah aktif. Harganya juga jauh lebih murah dari langganan biasa.",
    rating: 5,
    timeAgo: "2 hari lalu",
    verified: true,
  },
  {
    id: "t2",
    name: "Sari D.",
    product: "Spotify Family",
    text: "Udah langganan 3 bulan, ga pernah ada masalah. Admin responsif kalau ada pertanyaan. Recommended!",
    rating: 5,
    timeAgo: "5 hari lalu",
    verified: true,
  },
  {
    id: "t3",
    name: "Fajar M.",
    product: "Canva Pro",
    text: "QRIS-nya praktis, langsung bisa dipake. Buat pelajar kayak aku ini solusi terbaik deh.",
    rating: 5,
    timeAgo: "1 minggu lalu",
    verified: true,
  },
];

// Langkah cara kerja — 3 step visual
const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Pilih & Cek Harga",
    desc: "Browse katalog, pilih produk dan varian yang kamu mau. Harga transparan, tidak ada biaya tersembunyi.",
  },
  {
    step: "02",
    title: "Bayar Lewat QRIS",
    desc: "Scan QRIS dari aplikasi apapun. Konfirmasi pembayaran dan dapatkan ID order dalam hitungan detik.",
  },
  {
    step: "03",
    title: "Aktif & Pantau",
    desc: "Akun aktif dalam menit. Gunakan ID order untuk pantau status kapan saja di halaman Status.",
  },
];

function HomeSectionHead({ kicker, title, sub }) {
  return (
    <header className="home-sectionHead">
      {kicker ? <span className="home-kicker">{kicker}</span> : null}
      <h2 className="h2 home-sectionTitle">{title}</h2>
      {sub ? <p className="home-sectionSub">{sub}</p> : null}
    </header>
  );
}

function HomeFaqItem({ item, open, onToggle }) {
  return (
    <article className={`faq-item home-faqItem${open ? " open" : ""}`}>
      <button
        type="button"
        className="faq-itemHead"
        aria-expanded={open}
        onClick={() => onToggle(item.id)}
      >
        <span className="faq-itemQuestion">
          <span className="faq-itemCategory">{item.category}</span>
          <span>{item.question}</span>
        </span>
        <ChevronDown size={17} aria-hidden="true" />
      </button>

      <div className="faq-itemBodyWrap" aria-hidden={!open}>
        <div className="faq-itemBody">
          {item.answer.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </div>
    </article>
  );
}

function HomeProductSkeleton() {
  return (
    <div className="home-tileSkeleton" role="listitem" aria-hidden="true">
      <div className="home-tileSkeleton-top">
        <div className="home-tileSkeleton-icon" />
        <div className="home-tileSkeleton-textGroup">
          <div className="home-tileSkeleton-line w-72" />
          <div className="home-tileSkeleton-line w-50" />
        </div>
        <div className="home-tileSkeleton-arrow" />
      </div>
      <div className="home-tileSkeleton-bottom">
        <div className="home-tileSkeleton-pills">
          <div className="home-tileSkeleton-pill" />
          <div className="home-tileSkeleton-pill" />
          <div className="home-tileSkeleton-pill" />
        </div>
        <div className="home-tileSkeleton-price" />
      </div>
    </div>
  );
}

function HomeTestimonialCard({ item }) {
  return (
    <article className="home-testiCard">
      <div className="home-testiCard-header">
        <div className="home-testiCard-avatar" aria-hidden="true">
          {item.name.charAt(0)}
        </div>
        <div className="home-testiCard-meta">
          <span className="home-testiCard-nameRow">
            <span className="home-testiCard-name">{item.name}</span>
            {item.verified ? (
              <BadgeCheck size={14} className="home-testiCard-verified" aria-label="Terverifikasi" />
            ) : null}
          </span>
          <span className="home-testiCard-product">{item.product}</span>
        </div>
        <div className="home-testiCard-right">
          <div className="home-testiCard-stars" aria-label={`${item.rating} bintang`}>
            {Array.from({ length: item.rating }).map((_, i) => (
              <Star key={i} size={12} fill="currentColor" aria-hidden="true" />
            ))}
          </div>
          {item.timeAgo ? (
            <span className="home-testiCard-time">{item.timeAgo}</span>
          ) : null}
        </div>
      </div>
      <p className="home-testiCard-text">"{item.text}"</p>
    </article>
  );
}

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [topIds, setTopIds] = useState([]);
  const [promos, setPromos] = useState([]);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState("");
  const [openFaqId, setOpenFaqId] = useState(HOME_FAQ[0]?.id || null);
  const toast = useToast();

  useRevealOnScroll("home");

  usePageMeta({
    title: "Home",
    description: "Langganan premium buat pelajar \u2014 cepat, ringkas, anti ribet.",
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [data, ranking, promoData, settingsData] = await Promise.all([
          fetchProducts(),
          fetchTopSellingIds(),
          fetchPromoCodes().catch(() => []),
          fetchSettings().catch(() => ({})),
        ]);
        if (!alive) return;
        setProducts(data);
        setTopIds(ranking);
        setSettings(settingsData || {});

        const allowedCodes = settingsData?.home_promos?.codes || [];
        const activePromos = (promoData || [])
          .filter((p) => {
            if (!p.is_active) return false;
            if (!allowedCodes.includes(p.code)) return false;
            if (p.expired_at && new Date(p.expired_at) < new Date()) return false;
            if (p.max_uses != null && p.used_count >= p.max_uses) return false;
            return true;
          })
          .slice(0, 3);
        setPromos(activePromos);
      } catch (e) {
        console.warn(e);
        setError("Gagal memuat produk.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const popularProducts = useMemo(() => {
    if (products.length === 0) return [];
    const sorted = [...products].sort((a, b) => {
      const ra = topIds.indexOf(a.id);
      const rb = topIds.indexOf(b.id);
      if (ra !== -1 && rb === -1) return -1;
      if (ra === -1 && rb !== -1) return 1;
      if (ra !== -1 && rb !== -1) return ra - rb;
      return a.sort_order - b.sort_order;
    });
    return sorted.slice(0, 4);
  }, [products, topIds]);

  const totalActiveProducts = useMemo(
    () => products.filter((p) => (p?.product_variants || []).some((v) => v?.is_active)).length,
    [products]
  );

  const waNumber = String(settings?.whatsapp?.number || "").trim();
  const waHref = waNumber ? `https://wa.me/${waNumber.replace(/\D/g, "")}` : null;

  const handleCopyPromo = (code) => {
    copyToClipboard(code).then(
      () => {
        if (navigator.vibrate) navigator.vibrate(12);
        toast.success("Kode udah ke-copy!", { title: code, duration: 2000 });
      },
      () => toast.error("Gagal menyalin kupon.")
    );
  };

  return (
    <div className="page home-page">
      <Hero products={products} />
      <HomeStickyBar />

      <div className="home-body">
        {/* ── Produk Populer ── */}
        <section
          className="home-section reveal"
          style={{ transitionDelay: "40ms" }}
          aria-label="Produk populer"
        >
          <div className="container home-sectionInner">
            <HomeSectionHead
              kicker="Produk populer"
              title="Yang paling sering dipesan"
              sub="Langsung pilih dari daftar teratas, atau buka katalog lengkap."
            />

            <div
              className="product-grid-container home-popularList list-mode"
              role="list"
              aria-label="Produk populer"
            >
              {loading ? (
                <>
                  <HomeProductSkeleton />
                  <HomeProductSkeleton />
                  <HomeProductSkeleton />
                  <HomeProductSkeleton />
                </>
              ) : error ? (
                <div className="card pad" style={{ gridColumn: "1 / -1" }}>
                  <EmptyState icon="!" title="Gagal memuat" description={error} />
                </div>
              ) : popularProducts.length === 0 ? (
                <div className="card pad" style={{ gridColumn: "1 / -1" }}>
                  <EmptyState icon="-" title="Belum ada produk aktif" />
                </div>
              ) : (
                popularProducts.map((p, idx) => (
                  <ProductTile key={p.id} product={p} rank={idx + 1} layout="list" />
                ))
              )}
            </div>

            <div className="home-sectionCta">
              <Link className="btn" to="/produk">
                {!loading && totalActiveProducts > 4
                  ? `Lihat ${totalActiveProducts - 4} produk lainnya`
                  : "Lihat semua produk"}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {/* ── Kupon Promo — hanya tampil jika ada promo aktif ── */}
        {!loading && promos.length > 0 ? (
          <section
            className="home-section reveal"
            style={{ transitionDelay: "80ms" }}
            aria-label="Kupon Promo"
          >
            <div className="container home-sectionInner">
              <HomeSectionHead
                kicker="Kupon aktif"
                title="Diskon siap dipakai"
                sub="Tap kartu untuk menyalin kode promo."
              />

              <div className="home-promoGrid">
                {promos.map((promo) => (
                  <div
                    key={promo.code}
                    className="home-promoCard"
                    onClick={() => handleCopyPromo(promo.code)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && handleCopyPromo(promo.code)}
                    aria-label={`Salin kode promo ${promo.code} untuk diskon ${promo.percent}%`}
                  >
                    <div className="home-promoCard-stub">
                      <span className="home-promoCard-percent">{promo.percent}%</span>
                      <span className="home-promoCard-off">OFF</span>
                    </div>
                    <div className="home-promoCard-divider">
                      <div className="home-promoCard-punch top" />
                      <div className="home-promoCard-line" />
                      <div className="home-promoCard-punch bottom" />
                    </div>
                    <div className="home-promoCard-body">
                      <span className="home-promoCard-code">{promo.code}</span>
                      <span className="home-promoCard-action">Tap buat copy</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {/* ── Cara Kerja ── */}
        <section
          className="home-section home-howSection reveal"
          style={{ transitionDelay: "140ms" }}
          aria-label="Cara kerja"
        >
          <div className="container home-sectionInner">
            <HomeSectionHead
              kicker="Cara kerja"
              title="3 langkah, selesai dalam menit"
              sub="Dari pilih sampai aktif, prosesnya sesimpel ini."
            />
            <div className="home-howGrid">
              {HOW_IT_WORKS.map((step, i) => (
                <div key={step.step} className="home-howCard" style={{ "--how-i": i }}>
                  <div className="home-howCard-step" aria-hidden="true">{step.step}</div>
                  <div className="home-howCard-icon" aria-hidden="true">
                    <Zap size={20} />
                  </div>
                  <h3 className="home-howCard-title">{step.title}</h3>
                  <p className="home-howCard-desc">{step.desc}</p>
                  {i < HOW_IT_WORKS.length - 1 ? (
                    <div className="home-howCard-connector" aria-hidden="true" />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ Singkat ── */}
        <section
          className="home-section home-faqSection reveal"
          style={{ transitionDelay: "180ms" }}
          aria-label="FAQ singkat"
        >
          <div className="container home-sectionInner">
            <HomeSectionHead
              kicker="FAQ"
              title="Pertanyaan yang sering ditanyakan"
              sub="Jawaban singkat sebelum kamu order."
            />

            <div className="home-faqList">
              {HOME_FAQ.map((item) => (
                <HomeFaqItem
                  key={item.id}
                  item={item}
                  open={openFaqId === item.id}
                  onToggle={(id) => setOpenFaqId((cur) => (cur === id ? null : id))}
                />
              ))}
            </div>

            <div className="home-sectionCta">
              <Link className="btn btn-ghost" to="/tentang">
                Baca FAQ lengkap
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
