import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ChevronDown, Search, X } from "lucide-react";

import Hero from "../components/Hero";

import SectionHead from "../components/SectionHead";
import ProductTile from "../components/ProductTile";
import { fetchProducts, fetchTopSellingData, fetchPromoCodes, fetchSettings, peekCachedProducts, fetchActiveFlashSales } from "../lib/api";
import EmptyState from "../components/EmptyState";
import { usePageMeta } from "../hooks/usePageMeta";
import { useRevealOnScroll } from "../hooks/useRevealOnScroll";
import { isAcademicProduct } from "../lib/productCategories";
import { isPromoExpired } from "../lib/format";

import { useToast } from "../context/ToastContext";
import { copyToClipboard } from "../utils/clipboard";
import { fireConfetti } from "../components/Confetti";
import { warn } from "../lib/log";

// Start products fetch as soon as Home module evaluates (eager in App bundle)
// so hero backdrop can paint as soon as the first response/cache lands.
if (typeof window !== "undefined") {
  void fetchProducts({ useCache: true, ttlMs: 60_000 }).catch(() => {});
}

const HOME_FAQ = [
  {
    id: "home-pay",
    category: "Bayar",
    question: "Gimana cara bayarnya?",
    answer: [
      "Pilih paket, isi kontak di checkout, lalu lanjut bayar.",
      "Bayar lewat QRIS dan konfirmasikan pembayaran untuk mendapatkan ID pesanan.",
    ],
  },
  {
    id: "home-after-pay",
    category: "Order",
    question: "Udah bayar, terus gimana?",
    answer: [
      "Simpen ID order yang muncul abis konfirmasi.",
      "Buka halaman Status, masukin ID buat pantau progres.",
    ],
  },
  {
    id: "home-support",
    category: "Bantuan",
    question: "Ada error, hubungi ke mana?",
    answer: [
      "Pencet tombol Hubungi Admin di halaman bayar atau status.",
      "Sertain ID order biar ceknya cepet diproses.",
    ],
  },
];

// Langkah cara kerja — 3 step visual dengan detail tambahan untuk accordion
const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Pilih & Cek",
    desc: "Pilih produk dan paket sesuai kebutuhanmu. Cek harga, durasi, dan stok sebelum lanjut.",
    details: "Tipe akun dan garansi mengikuti paket yang kamu pilih.",
  },
  {
    step: "02",
    title: "Bayar QRIS",
    desc: "Bayar dengan bank atau e-wallet yang mendukung QRIS, lalu konfirmasikan pembayaran.",
    details: "Support GoPay, OVO, Dana, LinkAja, ShopeePay, dan M-Banking apapun.",
  },
  {
    step: "03",
    title: "Simpan & Pantau",
    desc: "Simpan ID pesanan. Admin akan memeriksa pembayaran sebelum memproses paketmu.",
    details: "Umumnya diproses 5–30 menit pada jam operasional; varian email maksimal 2 jam. Kendala bisa dilaporkan lewat WhatsApp Admin.",
  },
];

function HomeSectionHead(props) {
  return <SectionHead {...props} />;
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

function ScrollProgressBar() {
  // Use ref + direct DOM mutation instead of setState to avoid re-rendering
  // the entire Home component tree on every scroll tick.
  const barRef = useRef(null);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return undefined;
    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (totalScroll > 0) {
        bar.style.width = `${(window.scrollY / totalScroll) * 100}%`;
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return <div ref={barRef} className="home-scrollProgress" />;
}

function readSeededProducts() {
  return peekCachedProducts({ ttlMs: 120_000 }) || [];
}

export default function Home() {
  // Seed from sync cache so hero catalog backdrop paints on first frame
  const [products, setProducts] = useState(readSeededProducts);
  const [loading, setLoading] = useState(() => readSeededProducts().length === 0);
  const [topIds, setTopIds] = useState([]);
  const [salesMap, setSalesMap] = useState({});
  const [promos, setPromos] = useState([]);
  const [settings, setSettings] = useState(null);
  const [flashSaleMap, setFlashSaleMap] = useState(() => new Map());
  const [error, setError] = useState("");
  
  // Interactive States
  const [openFaqId, setOpenFaqId] = useState(HOME_FAQ[0]?.id || null);
  const [activeStep, setActiveStep] = useState(null);
  const [faqQuery, setFaqQuery] = useState("");

  const toast = useToast();
  const nav = useNavigate();
  useRevealOnScroll(loading);

  usePageMeta({
    title: "Beranda",
    description: "Langganan premium budget pelajar \u2014 cepet, gampang, anti ribet.",
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Fetch all initial storefront home data in one unified pass to prevent multiple layout shifts
        const [data, topData, promoData, settingsData, flashSales] = await Promise.all([
          fetchProducts({ useCache: true, ttlMs: 60_000 }),
          fetchTopSellingData().catch(() => ({ topIds: [], salesMap: {} })),
          fetchPromoCodes().catch(() => []),
          fetchSettings().catch(() => ({})),
          fetchActiveFlashSales({ useCache: true }).catch(() => []),
        ]);
        if (!alive) return;
        setTopIds(topData?.topIds || []);
        setSalesMap(topData?.salesMap || {});
        setSettings(settingsData || {});
        const nextFlash = new Map();
        (flashSales || []).forEach((sale) => {
          if (sale?.variant_id) nextFlash.set(sale.variant_id, sale.discount_percent);
        });
        setFlashSaleMap(nextFlash);

        const allowedCodes = settingsData?.home_promos?.codes || [];
        const activePromos = (promoData || [])
          .filter((p) => {
            if (!p.is_active) return false;
            if (!allowedCodes.includes(p.code)) return false;
            if (isPromoExpired(p)) return false;
            if (p.max_uses != null && p.used_count >= p.max_uses) return false;
            return true;
          })
          .slice(0, 3);
        setProducts(data || []);
        setPromos(activePromos);
        setLoading(false);
      } catch (e) {
        warn(e);
        if (alive) {
          setError("Gagal memuat produk.");
          setLoading(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const popularProducts = useMemo(() => {
    if (products.length === 0) return [];
    const sorted = [...products].sort((a, b) => {
      const soldA = salesMap[a.id] ?? (a.product_variants || []).reduce((sum, v) => sum + Number(v?.sold_count || 0), 0);
      const soldB = salesMap[b.id] ?? (b.product_variants || []).reduce((sum, v) => sum + Number(v?.sold_count || 0), 0);

      if (soldA !== soldB) return soldB - soldA;

      const ra = topIds.indexOf(a.id);
      const rb = topIds.indexOf(b.id);
      if (ra !== -1 && rb === -1) return -1;
      if (ra === -1 && rb !== -1) return 1;
      if (ra !== -1 && rb !== -1) return ra - rb;

      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
    return sorted.slice(0, 4);
  }, [products, topIds, salesMap]);

  /** All active academic / jasa akademik products for home section */
  const academicProducts = useMemo(() => {
    return (products || [])
      .filter(
        (p) =>
          p &&
          p.is_active !== false &&
          isAcademicProduct(p) &&
          (p.product_variants || []).some((v) => v?.is_active !== false)
      )
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [products]);

  const totalActiveProducts = useMemo(
    () => products.filter((p) => (p?.product_variants || []).some((v) => v?.is_active)).length,
    [products]
  );

  const handleCopyPromo = (code, e) => {
    copyToClipboard(code).then(
      () => {
        if (navigator.vibrate) navigator.vibrate(12);
        toast.success("Kode udah ke-copy!", { title: code, duration: 2000 });
        if (e && e.clientX && e.clientY) {
          fireConfetti(e.clientX, e.clientY);
        }
      },
      () => toast.error("Gagal menyalin kupon.")
    );
  };

  return (
    <div className="page home-page">
      {/* Scroll Progress Bar */}
      <ScrollProgressBar />

      <div className="hx-heroZone">
        <Hero products={products} topIds={topIds} />
      </div>

      <div className="home-body">
        {/* ── Produk Favorit ── */}
        <section
          className="home-section"
          aria-label="Produk favorit"
        >
          <div className="container home-sectionInner">
            <div className="reveal" style={{ transitionDelay: "60ms" }}>
              <HomeSectionHead
                kicker="Paling dicari"
                title="Terlaris"
                sub="Empat produk yang paling sering dibeli pelajar minggu ini."
              />
            </div>

            <div
              className="product-grid-container home-popularList list-mode"
              role="list"
              aria-label="Produk favorit"
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
                  <div key={p.id} className="reveal reveal-scale" style={{ transitionDelay: `${80 + idx * 70}ms` }}>
                    <ProductTile
                      product={p}
                      rank={idx + 1}
                      layout="list"
                      disableTilt={true}
                      disableFlip={true}
                      overrideSold={salesMap[p.id] != null ? salesMap[p.id] : null}
                      flashSaleMap={flashSaleMap}
                    />
                  </div>
                ))
              )}
            </div>

            <div className="home-sectionCta reveal" style={{ transitionDelay: `${80 + popularProducts.length * 70}ms` }}>
              <Link className="btn" to="/produk">
                {!loading && totalActiveProducts > 4
                  ? `Intip ${totalActiveProducts - 4} produk lainnya`
                  : "Lihat semua produk"}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {/* ── Jasa Akademik — semua produk line academic (tampil begitu data ada) ── */}
        {academicProducts.length > 0 ? (
          <section className="home-section home-academicSection" aria-label="Jasa Akademik">
            <div className="container home-sectionInner">
              <div className="reveal" style={{ transitionDelay: "50ms" }}>
                <HomeSectionHead
                  kicker="Bantuan tugas"
                  title="Jasa Akademik"
                  sub="Paraphrase, cek plagiasi, dan tools akademik dengan proses cepat."
                />
              </div>

              <div
                className="product-grid-container home-popularList home-academicList list-mode"
                role="list"
                aria-label="Semua jasa akademik"
              >
                {academicProducts.map((p, idx) => (
                  <div
                    key={p.id}
                    className="reveal reveal-scale"
                    style={{ transitionDelay: `${60 + idx * 55}ms` }}
                  >
                    <ProductTile
                      product={p}
                      layout="list"
                      disableTilt={true}
                      flashSaleMap={flashSaleMap}
                      disableFlip={true}
                    />
                  </div>
                ))}
              </div>

              <div
                className="home-sectionCta reveal"
                style={{ transitionDelay: `${70 + academicProducts.length * 50}ms` }}
              >
                <Link className="btn btn-ghost" to="/produk?cats=academic">
                  Lihat di katalog Jasa Akademik
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </section>
        ) : null}

        {/* ── Kupon Promo — hanya tampil jika ada promo aktif ── */}
        {!loading && promos.length > 0 ? (
          <section
            className="home-section"
            aria-label="Kupon Promo"
          >
            <div className="container home-sectionInner">
              <div className="reveal" style={{ transitionDelay: "60ms" }}>
                <HomeSectionHead
                  kicker="Hemat"
                  title="Promo"
                  sub="Copy kodenya, tempel saat checkout. Kuota terbatas."
                />
              </div>

              <div className="home-promoGrid">
                {promos.map((promo, idx) => (
                  <div
                    key={promo.code}
                    className="home-promoCard reveal reveal-scale"
                    style={{ transitionDelay: `${100 + idx * 100}ms` }}
                    onClick={(e) => handleCopyPromo(promo.code, e)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && handleCopyPromo(promo.code, e)}
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
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {/* ── Cara Kerja ── */}
        <section
          className="home-section home-howSection"
          aria-label="Cara kerja"
        >
          <div className="container home-sectionInner">
            <div className="reveal reveal-left" style={{ transitionDelay: "60ms" }}>
              <HomeSectionHead
                kicker="3 langkah"
                title="Cara beli"
                sub="Dari pilih produk sampai akun aktif, semuanya transparan."
              />
            </div>
            <div className="home-howGrid">
              {HOW_IT_WORKS.map((step, i) => {
                const isOpen = activeStep === i;
                return (
                  <button
                    type="button"
                    key={step.step}
                    className={`home-howCard reveal reveal-scale${isOpen ? " is-expanded" : ""}`}
                    style={{ "--how-i": i, transitionDelay: `${100 + i * 110}ms` }}
                    onClick={() => setActiveStep(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    aria-label={`Langkah ${step.step}: ${step.title}. ${isOpen ? "Tutup" : "Buka"} detail tambahan.`}
                  >
                    <div className="home-howCard-step" aria-hidden="true">{step.step}</div>
                    <div className="home-howCard-content">
                      <h3 className="home-howCard-title">{step.title}</h3>
                      <p className="home-howCard-desc">{step.desc}</p>
                      
                      {/* Accordion Expansion details */}
                      <div className={`home-howCard-expandedWrap${isOpen ? " open" : ""}`}>
                        <div className="home-howCard-expandedContent">
                          <p>{step.details}</p>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── FAQ Singkat ── */}
        <section
          className="home-section home-faqSection"
          aria-label="FAQ singkat"
        >
          <div className="container home-sectionInner">
            <div className="reveal" style={{ transitionDelay: "60ms" }}>
              <HomeSectionHead
                kicker="Pusat bantuan"
                title="FAQ"
                sub="Jawaban cepat soal pembayaran, order, dan kendala akun."
              />
            </div>

            {/* FAQ Search Bar linking to about page */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (faqQuery.trim()) {
                  nav(`/faq?q=${encodeURIComponent(faqQuery.trim())}`);
                }
              }}
              className="home-faqSearchWrap reveal"
              style={{ transitionDelay: "80ms" }}
            >
              <div className="faq-searchWrap">
                <Search size={16} aria-hidden="true" />
                <input
                  type="search"
                  className="input faq-searchInput"
                  placeholder="Cari: QRIS, ID order, promo..."
                  value={faqQuery}
                  onChange={(e) => setFaqQuery(e.target.value)}
                  aria-label="Cari FAQ"
                />
                {faqQuery ? (
                  <button
                    type="button"
                    className="faq-searchClear"
                    onClick={() => setFaqQuery("")}
                    aria-label="Hapus pencarian"
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>
            </form>

            <div className="home-faqList">
              {HOME_FAQ.map((item, idx) => (
                <div key={item.id} className="reveal" style={{ transitionDelay: `${90 + idx * 70}ms` }}>
                  <HomeFaqItem
                    item={item}
                    open={openFaqId === item.id}
                    onToggle={(id) => setOpenFaqId((cur) => (cur === id ? null : id))}
                  />
                </div>
              ))}
            </div>

            <div className="home-sectionCta reveal" style={{ transitionDelay: `${90 + HOME_FAQ.length * 70}ms` }}>
              <Link className="btn btn-ghost" to="/faq">
                Baca FAQ Lengkap
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

