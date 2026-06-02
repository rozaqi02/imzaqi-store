import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ShoppingBag, CreditCard, Hash, Activity } from "lucide-react";

import Hero from "../components/Hero";
import ProductTile from "../components/ProductTile";
import { fetchProducts, fetchTopSellingIds, fetchPromoCodes, fetchSettings, fetchActiveFlashSales } from "../lib/api";
import EmptyState from "../components/EmptyState";
import { usePageMeta } from "../hooks/usePageMeta";
import { useToast } from "../context/ToastContext";
import { copyToClipboard } from "../utils/clipboard";

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
    desc: "Scan QR dengan m-banking or e-wallet. Nominal sudah otomatis menyesuaikan total.",
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
  const [promos, setPromos] = useState([]);
  const [flashSales, setFlashSales] = useState([]);
  const [error, setError] = useState("");
  const toast = useToast();

  usePageMeta({
    title: "Home",
    description: "Premium apps cepat, ringkas, dan mudah dipilih.",
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [data, ranking, promoData, settingsData, flashSalesData] = await Promise.all([
          fetchProducts(),
          fetchTopSellingIds(),
          fetchPromoCodes().catch(() => []),
          fetchSettings().catch(() => ({})),
          fetchActiveFlashSales().catch(() => []),
        ]);
        if (!alive) return;
        setProducts(data);
        setTopIds(ranking);
        setFlashSales(flashSalesData);

        // Get allowed codes from site settings (empty array = hidden by default)
        const allowedHomeCodes = settingsData?.home_promos?.codes || [];

        // Filter valid active promos that are explicitly allowed in the setting
        const activePromos = (promoData || []).filter((p) => {
          if (!p.is_active) return false;
          if (!allowedHomeCodes.includes(p.code)) return false;
          if (p.expired_at && new Date(p.expired_at) < new Date()) return false;
          if (p.max_uses != null && p.used_count >= p.max_uses) return false;
          return true;
        }).slice(0, 3);
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

  const handleCopyPromo = (code) => {
    copyToClipboard(code).then(
      () => {
        if (navigator.vibrate) {
          navigator.vibrate(12);
        }
        toast.success("Kupon berhasil disalin!", { title: code, duration: 2000 });
      },
      () => {
        toast.error("Gagal menyalin kupon.");
      }
    );
  };

  return (
    <div className="page home-page">
      <Hero products={products} promos={promos} flashSales={flashSales} />

      {/* ── Diskon Hub ── */}
      {promos.length > 0 && (
        <section className="section home-promoSection" aria-label="Kupon Promo Aktif">
          <div className="container">
            <div className="home-promoHeader">
              <span className="home-kicker">Diskon Hub</span>
              <h2 className="h2 home-promoTitle">Gunakan kupon hemat.</h2>
            </div>
            
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
                    <span className="home-promoCard-action">Klik untuk salin</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

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

    </div>
  );
}
