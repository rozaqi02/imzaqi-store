import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ChevronDown,
  MessageCircle,
  ShoppingBag,
  CreditCard,
  Hash,
  Activity,
  Sparkles,
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

const HOW_IT_WORKS = [
  {
    step: "01",
    icon: ShoppingBag,
    title: "Cari & pilih",
    desc: "Scroll katalog, bandingin harga, masukin keranjang. Gampang.",
    to: "/produk",
    cta: "Gas ke katalog",
  },
  {
    step: "02",
    icon: CreditCard,
    title: "Bayar QRIS",
    desc: "Scan pakai e-wallet atau m-banking. Nominal udah otomatis.",
    to: "/tentang",
    cta: "Cara bayarnya",
  },
  {
    step: "03",
    icon: Hash,
    title: "Simpan ID-nya",
    desc: "Abis bayar, catat ID order kamu. Nanti buat cek progres.",
    to: "/status",
    cta: "Cek status",
  },
  {
    step: "04",
    icon: Activity,
    title: "Pantau progress",
    desc: "Buka halaman Status kapan aja — update real-time dari admin.",
    to: "/status",
    cta: "Lacak order",
  },
];

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

function useDesktopGrid(minWidth = 721) {
  const [isDesktopGrid, setIsDesktopGrid] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= minWidth : true
  );

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia(`(min-width: ${minWidth}px)`);
    const sync = () => setIsDesktopGrid(mq.matches);
    sync();
    if (typeof mq.addEventListener === "function") mq.addEventListener("change", sync);
    else mq.addListener(sync);
    return () => {
      if (typeof mq.removeEventListener === "function") mq.removeEventListener("change", sync);
      else mq.removeListener(sync);
    };
  }, [minWidth]);

  return isDesktopGrid;
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
  const isDesktopGrid = useDesktopGrid();

  useRevealOnScroll("home");

  usePageMeta({
    title: "Home",
    description: "Langganan premium buat pelajar — cepat, ringkas, anti ribet.",
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

        const allowedHomeCodes = settingsData?.home_promos?.codes || [];

        const activePromos = (promoData || [])
          .filter((p) => {
            if (!p.is_active) return false;
            if (!allowedHomeCodes.includes(p.code)) return false;
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

    return () => {
      alive = false;
    };
  }, []);

  const popularProducts = useMemo(() => {
    if (products.length === 0) return [];

    const sorted = [...products].sort((a, b) => {
      const rankA = topIds.indexOf(a.id);
      const rankB = topIds.indexOf(b.id);

      if (rankA !== -1 && rankB === -1) return -1;
      if (rankA === -1 && rankB !== -1) return 1;
      if (rankA !== -1 && rankB !== -1) return rankA - rankB;

      return a.sort_order - b.sort_order;
    });

    return sorted.slice(0, 4);
  }, [products, topIds]);

  const waNumber = String(settings?.whatsapp?.number || "").trim();
  const waHref = waNumber ? `https://wa.me/${waNumber.replace(/\D/g, "")}` : null;
  const productLayout = isDesktopGrid ? "grid" : "list";

  const handleCopyPromo = (code) => {
    copyToClipboard(code).then(
      () => {
        if (navigator.vibrate) {
          navigator.vibrate(12);
        }
        toast.success("Kode udah ke-copy!", { title: code, duration: 2000 });
      },
      () => {
        toast.error("Gagal menyalin kupon.");
      }
    );
  };

  return (
    <div className="page home-page">
      <Hero products={products} />
      <HomeStickyBar />

      <div className="home-body">
        <section className="home-section reveal" style={{ transitionDelay: "40ms" }} aria-label="Produk populer">
          <div className="container home-sectionInner">
            <HomeSectionHead
              kicker="Produk populer"
              title="Yang paling sering dipesan"
              sub="Langsung pilih dari daftar teratas, atau buka katalog lengkap."
            />

            <div
              className={`product-grid-container home-popularList ${isDesktopGrid ? "grid-mode" : "list-mode"}`}
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
                  <ProductTile key={p.id} product={p} rank={idx + 1} layout={productLayout} />
                ))
              )}
            </div>

            <div className="home-sectionCta">
              <Link className="btn btn-ghost" to="/produk">
                Lihat semua produk
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <section className="home-section reveal" style={{ transitionDelay: "80ms" }} aria-label="Kupon Promo">
          <div className="container home-sectionInner">
            <HomeSectionHead
              kicker="Kupon aktif"
              title={promos.length > 0 ? "Diskon siap dipakai" : "Belum ada kupon aktif"}
              sub={promos.length > 0 ? "Tap kartu untuk menyalin kode promo." : "Pantau update promo lewat admin atau FAQ."}
            />

            {promos.length > 0 ? (
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
            ) : (
              <div className="home-promoEmpty">
                <div className="home-promoEmpty-icon" aria-hidden="true">
                  <Sparkles size={22} />
                </div>
                <div className="home-promoEmpty-copy">
                  <strong>Promo baru bakal muncul di sini</strong>
                  <p>Pantau update lewat WhatsApp admin atau cek halaman FAQ untuk info terbaru.</p>
                </div>
                <div className="home-promoEmpty-actions">
                  {waHref ? (
                    <a className="btn btn-ghost" href={waHref} target="_blank" rel="noreferrer">
                      <MessageCircle size={16} aria-hidden="true" />
                      Hubungi Admin
                    </a>
                  ) : null}
                  <Link className="btn" to="/tentang">
                    Lihat FAQ
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="home-section reveal" style={{ transitionDelay: "120ms" }} aria-label="Cara beli">
          <div className="container home-sectionInner">
            <HomeSectionHead
              kicker="Cara beli"
              title="Empat langkah sampai order jalan"
              sub="Dari pilih produk sampai lacak status — semua bisa kamu pantau sendiri."
            />

            <div className="home-howGrid" role="list">
              {HOW_IT_WORKS.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.step} className="home-howCard" role="listitem">
                    <div className="home-howCard-step" aria-hidden="true">
                      {item.step}
                    </div>
                    <div className="home-howCard-icon" aria-hidden="true">
                      <Icon size={22} strokeWidth={2} />
                    </div>
                    <div className="home-howCard-content">
                      <h3 className="home-howCard-title">{item.title}</h3>
                      <p className="home-howCard-desc">{item.desc}</p>
                      <Link className="home-howCard-link" to={item.to}>
                        {item.cta}
                        <ArrowRight size={13} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="home-section home-faqSection reveal" style={{ transitionDelay: "160ms" }} aria-label="FAQ singkat">
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
                  onToggle={(id) => setOpenFaqId((current) => (current === id ? null : id))}
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