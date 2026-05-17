import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ShoppingBag, CreditCard, Hash, Activity, MessageSquareQuote } from "lucide-react";

import Hero from "../components/Hero";
import ProductTile from "../components/ProductTile";
import { fetchProducts, fetchTopSellingIds, fetchTestimonials } from "../lib/api";
import EmptyState from "../components/EmptyState";
import { usePageMeta } from "../hooks/usePageMeta";

const HOW_IT_WORKS = [
  {
    step: "01",
    icon: ShoppingBag,
    title: "Pilih paket",
    desc: "Cari produk di katalog, bandingkan varian dan harga, lalu tambahkan ke keranjang.",
    to: "/produk",
    cta: "Lihat katalog",
  },
  {
    step: "02",
    icon: CreditCard,
    title: "Bayar via QRIS",
    desc: "Scan QR dengan m-banking atau e-wallet. Nominal sudah otomatis menyesuaikan total.",
    to: "/tentang",
    cta: "Cara bayar",
  },
  {
    step: "03",
    icon: Hash,
    title: "Simpan ID order",
    desc: "Setelah konfirmasi, kamu dapat ID unik. Simpan ID ini untuk memantau progres order.",
    to: "/status",
    cta: "Cek status",
  },
  {
    step: "04",
    icon: Activity,
    title: "Pantau status",
    desc: "Buka halaman Status kapan saja dengan ID order. Admin akan update progres secara real-time.",
    to: "/status",
    cta: "Buka status",
  },
];

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

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [topIds, setTopIds] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [error, setError] = useState("");

  usePageMeta({
    title: "Home",
    description: "Premium apps cepat, ringkas, dan mudah dipilih.",
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [data, ranking, testiData] = await Promise.all([
          fetchProducts(),
          fetchTopSellingIds(),
          fetchTestimonials({ useCache: true }).catch(() => []),
        ]);
        if (!alive) return;
        setProducts(data);
        setTopIds(ranking);
        setTestimonials(testiData);
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

  const testimonialSnippets = useMemo(() => {
    return (testimonials || [])
      .filter((t) => t?.caption && String(t.caption).trim().length > 10)
      .slice(0, 3);
  }, [testimonials]);

  return (
    <div className="page home-page">
      <Hero products={products} />

      {/* ── How it works ── */}
      <section className="section home-howSection">
        <div className="container">
          <div className="home-howHeader">
            <div className="home-kicker">Alur pembelian</div>
            <h2 className="h2">Empat langkah, selesai.</h2>
            <p className="home-howSub">Dari pilih paket sampai order diproses, semuanya bisa dilacak dari satu halaman.</p>
          </div>

          <div className="home-howGrid" role="list">
            {HOW_IT_WORKS.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.step} className="home-howCard" role="listitem">
                  <div className="home-howCard-step" aria-hidden="true">{item.step}</div>
                  <div className="home-howCard-icon" aria-hidden="true">
                    <Icon size={22} strokeWidth={2} />
                  </div>
                  <h3 className="home-howCard-title">{item.title}</h3>
                  <p className="home-howCard-desc">{item.desc}</p>
                  <Link className="home-howCard-link" to={item.to}>
                    {item.cta}
                    <ArrowRight size={13} />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Popular products ── */}
      <section className="section">
        <div className="container">
          <div className="layout-header home-layoutHeader">
            <div>
              <div className="home-kicker">Mulai dari sini</div>
              <h2 className="h2">Paling laris disini.</h2>
            </div>
          </div>

          <div className="product-grid-container list-mode home-popularList" role="list" aria-label="Produk populer">
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
              popularProducts.map((p, idx) => <ProductTile key={p.id} product={p} rank={idx + 1} />)
            )}
          </div>

          <div className="home-bottomCta">
            <Link className="btn btn-ghost" to="/produk">
              <span>Buka semua produk</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Social proof / Testimonial snippets ── */}
      {testimonialSnippets.length > 0 ? (
        <section className="section home-testiSection">
          <div className="container">
            <div className="home-testiHeader">
              <div className="home-kicker">Kata mereka</div>
              <h2 className="h2">Bukan cuma klaim.</h2>
            </div>

            <div className="home-testiGrid">
              {testimonialSnippets.map((t) => (
                <div key={t.id} className="home-testiCard">
                  <div className="home-testiCard-quote" aria-hidden="true">
                    <MessageSquareQuote size={16} />
                  </div>
                  <p className="home-testiCard-text">
                    {String(t.caption).length > 120
                      ? `${String(t.caption).slice(0, 117).trimEnd()}...`
                      : t.caption}
                  </p>
                </div>
              ))}
            </div>

            <div className="home-testiCta">
              <Link className="btn btn-ghost" to="/testimoni">
                <span>Lihat semua testimoni</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
