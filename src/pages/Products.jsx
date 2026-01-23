import React, { useEffect, useMemo, useState } from "react";
import ProductCard from "../components/ProductCard";
import { fetchProducts } from "../lib/api";

export default function Products() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState("");

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
      (p.description || "").toLowerCase().includes(q) ||
      (p.product_variants || []).some(v => v.name.toLowerCase().includes(q))
    );
  }, [products, query]);

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
            onChange={(e) => setQuery(e.target.value)}
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
          ) : filtered.map(p => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>

        <div className="container hint subtle">
          *Catatan: pastikan produk yang kamu jual tidak melanggar kebijakan platform/layanan terkait.
        </div>
      </section>
    </div>
  );
}
