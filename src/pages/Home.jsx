import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ChevronDown, Search, X, Zap } from "lucide-react";

import Hero from "../components/Hero";
import HomeStickyBar from "../components/HomeStickyBar";
import "../css/pages/Home.css";
import ProductTile from "../components/ProductTile";
import { fetchProducts, fetchTopSellingIds, fetchPromoCodes, fetchSettings } from "../lib/api";
import EmptyState from "../components/EmptyState";
import { usePageMeta } from "../hooks/usePageMeta";
import { useRevealOnScroll } from "../hooks/useRevealOnScroll";
import { useToast } from "../context/ToastContext";
import { copyToClipboard } from "../utils/clipboard";
import { fireConfetti } from "../components/Confetti";
import { warn } from "../lib/log";

const HOME_FAQ = [
  {
    id: "home-pay",
    category: "Bayar",
    question: "Gimana cara bayarnya?",
    answer: [
      "Pilih produk + varian, lanjut ke halaman bayar.",
      "Scan QRIS sesuai total, konfirmasi, dapet ID order.",
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
    question: "Error/error, hubungi ke mana?",
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
    desc: "Browse katalog, pilih produk dan varian yang kamu mau. Harganya transparan, no biaya tersembunyi.",
    details: "Cek rincian tipe akun (Private/Sharing), durasi, dan garansi replace full.",
  },
  {
    step: "02",
    title: "Bayar QRIS",
    desc: "Scan QRIS dari app apa aja. Konfirmasi, dapet ID order dalam hitungan detik.",
    details: "Support GoPay, OVO, Dana, LinkAja, ShopeePay, dan M-Banking apapun.",
  },
  {
    step: "03",
    title: "Gas & Pantau",
    desc: "Akun aktif dalam hitungan menit. Pake ID order buat pantau status di halaman Status.",
    details: "Detail login dikirim instan. Garansi hangus/replace bisa diklaim 24 jam lewat WhatsApp Admin.",
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

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [topIds, setTopIds] = useState([]);
  const [promos, setPromos] = useState([]);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState("");
  
  // Interactive States
  const [openFaqId, setOpenFaqId] = useState(HOME_FAQ[0]?.id || null);
  const [activeStep, setActiveStep] = useState(null);
  const [faqQuery, setFaqQuery] = useState("");

  const toast = useToast();
  const nav = useNavigate();

  useRevealOnScroll();

  usePageMeta({
    title: "Home",
    description: "Langganan premium budget pelajar \u2014 cepet, gampang, anti ribet.",
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
        warn(e);
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

      <Hero products={products} />
      <HomeStickyBar />

      <div className="home-body">
        {/* ── Produk Favorit ── */}
        <section
          className="home-section"
          aria-label="Produk favorit"
        >
          <div className="container home-sectionInner">
            <div className="reveal" style={{ transitionDelay: "40ms" }}>
              <HomeSectionHead
                kicker="Produk favorit"
                title="Yang lagi viral"
                sub="Gas pilih langsung dari daftar teratas, atau intip katalog lengkap."
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
                  <div key={p.id} className="reveal reveal-scale" style={{ transitionDelay: `${120 + idx * 80}ms` }}>
                    {/* 3D Tilt disabled with disableTilt={true} */}
                    <ProductTile product={p} rank={idx + 1} layout="list" disableTilt={true} />
                  </div>
                ))
              )}
            </div>

            <div className="home-sectionCta reveal" style={{ transitionDelay: `${120 + popularProducts.length * 80}ms` }}>
              <Link className="btn" to="/produk">
                {!loading && totalActiveProducts > 4
                  ? `Intip ${totalActiveProducts - 4} produk lainnya`
                  : "Lihat semua produk"}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {/* ── Kupon Promo — hanya tampil jika ada promo aktif ── */}
        {!loading && promos.length > 0 ? (
          <section
            className="home-section"
            aria-label="Kupon Promo"
          >
            <div className="container home-sectionInner">
              <div className="reveal" style={{ transitionDelay: "40ms" }}>
                <HomeSectionHead
                  kicker="Promo aktif"
                  title="Diskon, gas!"
                  sub="Tap kartu buat salin kode promo."
                />
              </div>

              <div className="home-promoGrid">
                {promos.map((promo, idx) => (
                  <div
                    key={promo.code}
                    className="home-promoCard reveal reveal-scale"
                    style={{ transitionDelay: `${120 + idx * 80}ms` }}
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
                      <span className="home-promoCard-action">Tap buat salin</span>
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
            <div className="reveal reveal-left" style={{ transitionDelay: "40ms" }}>
              <HomeSectionHead
                kicker="Gampang"
                title="3 langkah doang, gas!"
                sub="Dari pilih sampai aktif. Tap kartu buat tips ekstra."
              />
            </div>
            <div className="home-howGrid">
              {HOW_IT_WORKS.map((step, i) => {
                const isOpen = activeStep === i;
                return (
                  <div
                    key={step.step}
                    className={`home-howCard reveal reveal-scale${isOpen ? " is-expanded" : ""}`}
                    style={{ "--how-i": i, transitionDelay: `${120 + i * 80}ms`, cursor: "pointer" }}
                    onClick={() => setActiveStep(isOpen ? null : i)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && setActiveStep(isOpen ? null : i)}
                  >
                    <div className="home-howCard-step" aria-hidden="true">{step.step}</div>
                    <div className="home-howCard-icon" aria-hidden="true">
                      <Zap size={20} />
                    </div>
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
                    {i < HOW_IT_WORKS.length - 1 ? (
                      <div className="home-howCard-connector" aria-hidden="true" />
                    ) : null}
                  </div>
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
            <div className="reveal" style={{ transitionDelay: "40ms" }}>
              <HomeSectionHead
                kicker="FAQ"
                title="Yang sering ditanyakan"
                sub="Jawaban singkat biar makin pede."
              />
            </div>

            {/* FAQ Search Bar linking to about page */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (faqQuery.trim()) {
                  nav(`/tentang?q=${encodeURIComponent(faqQuery.trim())}`);
                }
              }}
              className="home-faqSearchWrap reveal reveal-scale"
              style={{ transitionDelay: "80ms" }}
            >
              <div className="home-faqSearchShell">
                <Search size={16} className="home-faqSearchIcon" />
                <input
                  type="text"
                  placeholder="Cari pertanyaan di sini... (Enter)"
                  value={faqQuery}
                  onChange={(e) => setFaqQuery(e.target.value)}
                  className="home-faqSearchInput"
                  aria-label="Cari FAQ"
                />
                {faqQuery ? (
                  <button
                    type="button"
                    className="home-faqSearchClear"
                    onClick={() => setFaqQuery("")}
                    aria-label="Hapus pencarian FAQ"
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>
            </form>

            <div className="home-faqList">
              {HOME_FAQ.map((item, idx) => (
                <div key={item.id} className="reveal reveal-blur" style={{ transitionDelay: `${120 + idx * 80}ms` }}>
                  <HomeFaqItem
                    item={item}
                    open={openFaqId === item.id}
                    onToggle={(id) => setOpenFaqId((cur) => (cur === id ? null : id))}
                  />
                </div>
              ))}
            </div>

            <div className="home-sectionCta reveal" style={{ transitionDelay: `${120 + HOME_FAQ.length * 80}ms` }}>
              <Link className="btn btn-ghost" to="/tentang">
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

