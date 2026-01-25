import React, { useEffect, useMemo, useState } from "react";
import Hero from "../components/Hero";
import ProductCard from "../components/ProductCard";
import { fetchProducts } from "../lib/api";
import { Link } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import { usePageMeta } from "../hooks/usePageMeta";

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState("");

  usePageMeta({
    title: "Home",
    description:
      "Hidden gem aplikasi premium murah + bergaransi. Pilih produk, checkout QRIS, upload bukti bayar, lalu pantau status order.",
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await fetchProducts();
        if (!alive) return;
        setProducts(data);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn(e);
        setError("Gagal memuat produk. Coba cek koneksi & refresh.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const featured = useMemo(() => products.slice(0, 3), [products]);

  return (
    <div className="page">
      <Hero />

      <section className="section reveal">
        <div className="container section-head">
          <div>
            <h2 className="h2">Produk populer</h2>
            <p className="muted">Harga mengikuti pricelist terbaru. Kamu bisa checkout kapan saja.</p>
          </div>
          <Link className="btn btn-ghost" to="/produk">Lihat semua</Link>
        </div>

        <div className="container grid-3">
          {loading ? (
            <>
              <div className="skeleton card" />
              <div className="skeleton card" />
              <div className="skeleton card" />
            </>
          ) : error ? (
            <div className="card pad" style={{ gridColumn: "1 / -1" }}>
              <EmptyState
                icon="📡"
                title="Produk belum bisa dimuat"
                description={error}
                primaryAction={{ label: "Refresh", onClick: () => window.location.reload() }}
                secondaryAction={{ label: "Lihat Status Order", to: "/status" }}
              />
            </div>
          ) : featured.length === 0 ? (
            <div className="card pad" style={{ gridColumn: "1 / -1" }}>
              <EmptyState
                icon="🛍️"
                title="Belum ada produk aktif"
                description="Admin belum mengaktifkan produk. Coba lagi nanti ya."
                secondaryAction={{ label: "Cek Status Order", to: "/status" }}
              />
            </div>
          ) : (
            featured.map((p) => <ProductCard key={p.id} product={p} />)
          )}
        </div>
      </section>

      <section className="section reveal">
        <div className="container info-strip">
          <div className="info-item">
            <div className="info-title">Checkout QRIS</div>
            <div className="info-sub">Bayar cepat, bukti bayar langsung lanjut WhatsApp.</div>
          </div>
          <div className="info-item">
            <div className="info-title">Garansi jelas</div>
            <div className="info-sub">Sesuai paket. Detail ada di setiap varian.</div>
          </div>
          <div className="info-item">
            <div className="info-title">Harga selalu terbaru</div>
            <div className="info-sub">Pricelist diperbarui berkala. Kamu selalu dapat harga terkini.</div>
          </div>
        </div>
      </section>
    </div>
  );
}
