import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import { fetchProducts } from "../lib/api";
import EmptyState from "../components/EmptyState";
import { usePageMeta } from "../hooks/usePageMeta";

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQ = searchParams.get("q") || "";

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState(initialQ);
  const [error, setError] = useState("");

  usePageMeta({
    title: "Produk",
    description: "Pilih produk & varian, tambahkan ke keranjang, lalu checkout QRIS. Ada promo juga kalau kamu punya kodenya.",
  });

  useEffect(() => {
    // keep input synced if user lands from Hero search
    setQuery(initialQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQ]);

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
        setError("Gagal memuat produk. Coba cek koneksi atau refresh.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.slug || "").toLowerCase().includes(q) ||
      (p.description || "").toLowerCase().includes(q) ||
      (p.product_variants || []).some(v =>
        v.name.toLowerCase().includes(q) ||
        (v.duration_label || "").toLowerCase().includes(q)
      )
    );
  }, [products, query]);

  function onChangeQuery(next) {
    setQuery(next);
    const trimmed = next.trim();
    if (!trimmed) {
      searchParams.delete("q");
      setSearchParams(searchParams, { replace: true });
    } else {
      setSearchParams({ q: trimmed }, { replace: true });
    }
  }

  return (
    <div className="page">
      <section className="section reveal">
        <div className="container section-head">
          <div>
            <h1 className="h1">Produk</h1>
            <p className="muted">Pilih produk & varian, lalu tambah ke keranjang.</p>
          </div>
          <input
            className="input search"
            placeholder="Cari (contoh: netflix, 1 bulan, famplan)..."
            value={query}
            onChange={(e) => onChangeQuery(e.target.value)}
          />
        </div>

        <div className="container grid-2">
          {loading ? (
            <>
              <div className="skeleton card" />
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
                secondaryAction={{ label: "Cek Status Order", to: "/status" }}
              />
            </div>
          ) : filtered.length === 0 ? (
            <div className="card pad" style={{ gridColumn: "1 / -1" }}>
              <EmptyState
                icon="🔎"
                title="Tidak ada yang cocok"
                description={
                  query.trim()
                    ? `Tidak ditemukan produk/varian untuk “${query.trim()}”. Coba kata kunci lain ya.`
                    : "Belum ada produk aktif saat ini."
                }
                primaryAction={
                  query.trim()
                    ? { label: "Hapus pencarian", onClick: () => onChangeQuery("") }
                    : { label: "Refresh", onClick: () => window.location.reload() }
                }
                secondaryAction={{ label: "Buka Checkout", to: "/checkout" }}
              />
            </div>
          ) : (
            filtered.map((p) => <ProductCard key={p.id} product={p} />)
          )}
        </div>

        <div className="container hint subtle">
          *Catatan: pastikan produk yang kamu jual tidak melanggar kebijakan platform/layanan terkait.
        </div>
      </section>
    </div>
  );
}
