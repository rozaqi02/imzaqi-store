import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { fetchProducts } from "../lib/api";
import EmptyState from "../components/EmptyState";
import { usePageMeta } from "../hooks/usePageMeta";
import { useCart } from "../context/CartContext";
import { formatIDR } from "../lib/format";

const CATEGORIES = [
  { key: "streaming", label: "Streaming", emoji: "🎬" },
  { key: "music", label: "Music", emoji: "🎧" },
  { key: "tools", label: "Tools", emoji: "🧩" },
  { key: "learning", label: "Belajar", emoji: "📚" },
  { key: "other", label: "Lainnya", emoji: "✨" },
];

function inferCategory(p) {
  const blob = `${p?.slug || ""} ${p?.name || ""}`.toLowerCase();
  if (/(netflix|disney|hotstar|prime|viu|vidio|iqiyi|bstation)/.test(blob)) return "streaming";
  if (/(spotify|youtube)/.test(blob)) return "music";
  if (/(canva|capcut|chatgpt|zoom|getcontact)/.test(blob)) return "tools";
  if (/(duolingo)/.test(blob)) return "learning";
  return "other";
}

function clamp(n, a, b) {
  const x = Number(n);
  if (!Number.isFinite(x)) return a;
  return Math.max(a, Math.min(b, x));
}

function formatCompactIDR(n) {
  const x = Number(n || 0);
  if (!Number.isFinite(x)) return "0";
  // 1000 -> 1k, 10000 -> 10k
  if (x >= 1000000) return `${Math.round(x / 100000) / 10}jt`;
  if (x >= 1000) return `${Math.round(x / 100) / 10}k`;
  return String(x);
}

function Range({ min, max, valueMin, valueMax, step = 1000, onChange }) {
  // Two-thumb range slider using two range inputs.
  // valueMin <= valueMax
  const left = max <= min ? 0 : ((valueMin - min) / (max - min)) * 100;
  const right = max <= min ? 100 : ((valueMax - min) / (max - min)) * 100;
  const trackStyle = {
    background: `linear-gradient(90deg, rgba(255,255,255,.12) 0%, rgba(255,255,255,.12) ${left}%, rgba(31,128,224,.65) ${left}%, rgba(31,128,224,.65) ${right}%, rgba(255,255,255,.12) ${right}%, rgba(255,255,255,.12) 100%)`,
  };

  return (
    <div className="range" aria-label="Filter harga">
      <div className="range-track" style={trackStyle} />
      <input
        className="range-input"
        type="range"
        min={min}
        max={max}
        step={step}
        value={valueMin}
        onChange={(e) => {
          const nextMin = Number(e.target.value);
          onChange?.({ min: Math.min(nextMin, valueMax), max: valueMax });
        }}
        aria-label="Harga minimum"
      />
      <input
        className="range-input"
        type="range"
        min={min}
        max={max}
        step={step}
        value={valueMax}
        onChange={(e) => {
          const nextMax = Number(e.target.value);
          onChange?.({ min: valueMin, max: Math.max(nextMax, valueMin) });
        }}
        aria-label="Harga maksimum"
      />

      <div className="range-values">
        <span className="range-pill">{formatCompactIDR(valueMin)}</span>
        <span className="range-sep">—</span>
        <span className="range-pill">{formatCompactIDR(valueMax)}</span>
      </div>
    </div>
  );
}

function FilterPanel({
  query,
  setQuery,
  cats,
  toggleCat,
  inStockOnly,
  setInStockOnly,
  priceBounds,
  price,
  setPrice,
  sort,
  setSort,
  view,
  setView,
  onReset,
  compact = false,
}) {
  return (
    <div className={compact ? "pfilters pfilters-compact" : "pfilters"}>
      <div className="pfilters-section">
        <div className="pfilters-label">Pencarian</div>
        <div className="pfilters-search">
          <input
            className="input pfilters-searchInput"
            value={query}
            placeholder="Cari Netflix, Canva, ChatGPT…"
            onChange={(e) => setQuery(e.target.value)}
          />
          {query ? (
            <button
              type="button"
              className="pfilters-clear"
              onClick={() => setQuery("")}
              aria-label="Hapus pencarian"
              title="Hapus"
            >
              ×
            </button>
          ) : null}
        </div>
        <div className="hint subtle">Tip: tekan <b>/</b> untuk fokus ke search.</div>
      </div>

      <div className="pfilters-section">
        <div className="pfilters-label">Kategori</div>
        <div className="pfilters-chips" role="list">
          {CATEGORIES.map((c) => {
            const active = cats.includes(c.key);
            return (
              <button
                key={c.key}
                type="button"
                className={"chip " + (active ? "active" : "")}
                onClick={() => toggleCat(c.key)}
                role="listitem"
                aria-pressed={active}
              >
                <span className="chip-ic" aria-hidden="true">{c.emoji}</span>
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="pfilters-section">
        <div className="pfilters-row">
          <div className="pfilters-label">Hanya yang ready</div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => setInStockOnly(e.target.checked)}
            />
            <span className="toggle-ui" aria-hidden="true" />
          </label>
        </div>
        <div className="hint subtle">Filter ini menghitung dari total stok varian yang aktif.</div>
      </div>

      <div className="pfilters-section">
        <div className="pfilters-label">Harga</div>
        <Range
          min={priceBounds.min}
          max={priceBounds.max}
          valueMin={price.min}
          valueMax={price.max}
          step={1000}
          onChange={(r) => setPrice(r)}
        />
        <div className="pfilters-priceText">
          Menampilkan produk dengan harga <b>mulai</b> antara <b>{formatIDR(price.min)}</b> – <b>{formatIDR(price.max)}</b>.
        </div>
      </div>

      <div className="pfilters-section">
        <div className="pfilters-label">Urutkan</div>
        <select className="input pfilters-select" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="reco">Rekomendasi</option>
          <option value="popular">Terlaris</option>
          <option value="price_asc">Harga termurah</option>
          <option value="price_desc">Harga termahal</option>
          <option value="stock_desc">Stok terbanyak</option>
          <option value="name">Nama A → Z</option>
        </select>
      </div>

      <div className="pfilters-section">
        <div className="pfilters-label">Tampilan</div>
        <div className="pfilters-view">
          <button
            type="button"
            className={"viewbtn " + (view === "grid" ? "active" : "")}
            onClick={() => setView("grid")}
            aria-pressed={view === "grid"}
          >
            ⬚ Grid
          </button>
          <button
            type="button"
            className={"viewbtn " + (view === "list" ? "active" : "")}
            onClick={() => setView("list")}
            aria-pressed={view === "list"}
          >
            ☰ List
          </button>
        </div>
      </div>

      <div className="pfilters-actions">
        <button type="button" className="btn btn-ghost btn-wide" onClick={onReset}>
          Reset filter
        </button>
      </div>
    </div>
  );
}

export default function Products() {
  const [params, setParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState("");

  const qParam = params.get("q") || "";
  const [query, setQuery] = useState(qParam);

  const searchRef = useRef(null);

  const { items, subtotal } = useCart();
  const cartItemCount = items?.reduce((s, x) => s + (x.qty || 0), 0) || 0;

  const [cats, setCats] = useState([]);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState("reco");
  const [view, setView] = useState("grid");
  const [filtersOpen, setFiltersOpen] = useState(false);

  usePageMeta({
    title: "Produk",
    description:
      "Jelajahi produk (dengan filter & ikon), lalu klik untuk buka detail paket dan tambah ke keranjang.",
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const data = await fetchProducts();
        if (!alive) return;
        setProducts(data);
      } catch (e) {
        console.warn(e);
        if (!alive) return;
        setError("Gagal memuat produk.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // Keep query in URL (shareable link)
  useEffect(() => {
    const next = String(query || "").trim();
    const cur = params.get("q") || "";
    if (next === cur) return;

    if (!next) {
      params.delete("q");
      setParams(params, { replace: true });
      return;
    }

    params.set("q", next);
    setParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Keyboard shortcut: "/" to focus search
  useEffect(() => {
    function onKey(e) {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const tag = (e.target?.tagName || "").toLowerCase();
        if (tag === "input" || tag === "textarea") return;
        e.preventDefault();
        searchRef.current?.focus?.();
      }
      if (e.key === "Escape" && filtersOpen) setFiltersOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [filtersOpen]);

  const enriched = useMemo(() => {
    return (products || []).map((p) => {
      const vars = (p?.product_variants || [])
        .slice()
        .filter((v) => v?.is_active)
        .sort((a, b) => (a?.sort_order || 0) - (b?.sort_order || 0));

      const prices = vars
        .map((v) => Number(v?.price_idr || 0))
        .filter((n) => Number.isFinite(n) && n > 0);

      const minPrice = prices.length ? Math.min(...prices) : 0;
      const maxPrice = prices.length ? Math.max(...prices) : 0;

      const stock = vars.reduce((s, v) => s + Number(v?.stock || 0), 0);
      const sold = vars.reduce((s, v) => s + Number(v?.sold_count || 0), 0);
      const durations = Array.from(
        new Set(vars.map((v) => String(v?.duration_label || "").trim()).filter(Boolean))
      );

      return {
        ...p,
        _vars: vars,
        _minPrice: minPrice,
        _maxPrice: maxPrice,
        _stock: stock,
        _sold: sold,
        _durations: durations,
        _category: inferCategory(p),
      };
    });
  }, [products]);

  const priceBounds = useMemo(() => {
    const prices = enriched.map((p) => p._minPrice).filter((n) => Number.isFinite(n) && n > 0);
    if (!prices.length) return { min: 0, max: 0 };
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return { min, max };
  }, [enriched]);

  const [price, setPrice] = useState({ min: 0, max: 0 });
  const [priceReady, setPriceReady] = useState(false);

  useEffect(() => {
    if (!priceReady && priceBounds.max > 0) {
      setPrice({ min: priceBounds.min, max: priceBounds.max });
      setPriceReady(true);
    }
  }, [priceBounds.min, priceBounds.max, priceReady]);

  // keep range clamped when bounds change
  useEffect(() => {
    if (!priceReady) return;
    setPrice((prev) => ({
      min: clamp(prev.min, priceBounds.min, priceBounds.max),
      max: clamp(prev.max, priceBounds.min, priceBounds.max),
    }));
  }, [priceBounds.min, priceBounds.max, priceReady]);

  function toggleCat(key) {
    setCats((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
  }

  function resetFilters() {
    setQuery("");
    setCats([]);
    setInStockOnly(false);
    setSort("reco");
    setView("grid");
    if (priceBounds.max > 0) setPrice({ min: priceBounds.min, max: priceBounds.max });
  }

  const filtered = useMemo(() => {
    const s = String(query || "").trim().toLowerCase();
    let list = (enriched || []).filter((p) => p?.is_active);

    if (cats.length) list = list.filter((p) => cats.includes(p._category));
    if (inStockOnly) list = list.filter((p) => Number(p._stock || 0) > 0);

    if (priceBounds.max > 0) {
      list = list.filter((p) => {
        const mp = Number(p._minPrice || 0);
        if (!mp) return true;
        return mp >= price.min && mp <= price.max;
      });
    }

    if (s) {
      list = list.filter((p) => {
        const name = String(p?.name || "").toLowerCase();
        const slug = String(p?.slug || "").replace(/-/g, " ").toLowerCase();
        const desc = String(p?.description || "").toLowerCase();
        const variants = (p?._vars || [])
          .map((v) => `${v?.name || ""} ${v?.duration_label || ""}`.toLowerCase())
          .join(" ");
        return name.includes(s) || slug.includes(s) || desc.includes(s) || variants.includes(s);
      });
    }

    // sort
    const byName = (a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), "id");
    const byReco = (a, b) => (a?.sort_order || 0) - (b?.sort_order || 0);
    const byPopular = (a, b) => (b?._sold || 0) - (a?._sold || 0) || byReco(a, b);
    const byMinPriceAsc = (a, b) => (a?._minPrice || 0) - (b?._minPrice || 0) || byReco(a, b);
    const byMinPriceDesc = (a, b) => (b?._minPrice || 0) - (a?._minPrice || 0) || byReco(a, b);
    const byStockDesc = (a, b) => (b?._stock || 0) - (a?._stock || 0) || byReco(a, b);

    const sorted = list.slice();
    if (sort === "popular") sorted.sort(byPopular);
    else if (sort === "price_asc") sorted.sort(byMinPriceAsc);
    else if (sort === "price_desc") sorted.sort(byMinPriceDesc);
    else if (sort === "stock_desc") sorted.sort(byStockDesc);
    else if (sort === "name") sorted.sort(byName);
    else sorted.sort(byReco);
    return sorted;
  }, [cats, enriched, inStockOnly, price.min, price.max, priceBounds.max, query, sort]);

  const activeCount = useMemo(() => enriched.filter((p) => p?.is_active).length, [enriched]);
  const minStartingPrice = useMemo(() => {
    const xs = enriched.map((p) => p._minPrice).filter((n) => Number.isFinite(n) && n > 0);
    return xs.length ? Math.min(...xs) : 0;
  }, [enriched]);

  const activeFiltersCount =
    (query ? 1 : 0) +
    (cats.length ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (priceReady && (price.min !== priceBounds.min || price.max !== priceBounds.max) ? 1 : 0) +
    (sort !== "reco" ? 1 : 0);

  const skeletonCount = view === "list" ? 6 : 10;

  return (
    <div className={cartItemCount > 0 ? "page with-sticky-cta" : "page"}>
      <section className="section products3-hero reveal">
        <div className="container">
          <div className="products3-heroTop">
            <div>
              <div className="products3-badge">Katalog</div>
              <h1 className="h1 products3-title">Produk</h1>
              <p className="products3-sub">
                Pilih aplikasi yang kamu mau — klik untuk buka detail paket & tambah ke keranjang.
              </p>
            </div>

            <div className="products3-heroStats" aria-label="Ringkasan katalog">
              <div className="pstat">
                <div className="pstat-k">Produk aktif</div>
                <div className="pstat-v">{activeCount}</div>
              </div>
              <div className="pstat">
                <div className="pstat-k">Mulai dari</div>
                <div className="pstat-v">{minStartingPrice ? formatIDR(minStartingPrice) : "—"}</div>
              </div>
              <div className="pstat">
                <div className="pstat-k">Filter aktif</div>
                <div className="pstat-v">{activeFiltersCount}</div>
              </div>
            </div>
          </div>

          <div className="products3-toolbar">
            <div className="products3-searchWrap">
              <span className="products3-searchIc" aria-hidden="true">⌕</span>
              <input
                ref={searchRef}
                className="input products3-search"
                value={query}
                placeholder="Cari produk / varian / durasi…"
                onChange={(e) => setQuery(e.target.value)}
              />
              {query ? (
                <button className="products3-clear" onClick={() => setQuery("")} type="button" aria-label="Hapus pencarian">
                  ×
                </button>
              ) : null}
            </div>

            <div className="products3-actions">
              <button
                type="button"
                className="btn btn-ghost products3-filterBtn"
                onClick={() => setFiltersOpen(true)}
              >
                Filter{activeFiltersCount ? ` (${activeFiltersCount})` : ""}
              </button>
              <div className="products3-sortDesktop">
                <select className="input products3-sort" value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="reco">Rekomendasi</option>
                  <option value="popular">Terlaris</option>
                  <option value="price_asc">Harga termurah</option>
                  <option value="price_desc">Harga termahal</option>
                  <option value="stock_desc">Stok terbanyak</option>
                  <option value="name">Nama A → Z</option>
                </select>
              </div>
              <button
                type="button"
                className="btn btn-ghost products3-reset"
                onClick={resetFilters}
                title="Reset"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="section reveal" style={{ paddingTop: 0 }}>
        <div className="container products3-layout">
          <aside className="products3-sidebar" aria-label="Filter produk">
            <FilterPanel
              query={query}
              setQuery={setQuery}
              cats={cats}
              toggleCat={toggleCat}
              inStockOnly={inStockOnly}
              setInStockOnly={setInStockOnly}
              priceBounds={priceBounds}
              price={price}
              setPrice={setPrice}
              sort={sort}
              setSort={setSort}
              view={view}
              setView={setView}
              onReset={resetFilters}
            />
          </aside>

          <div className="products3-content">
            <div className="products3-activeBar" aria-label="Filter yang aktif">
              <div className="products3-count">
                {loading ? "Memuat…" : `${filtered.length} produk`}
              </div>
              <div className="products3-viewDesktop">
                <button type="button" className={"viewbtn " + (view === "grid" ? "active" : "")} onClick={() => setView("grid")}>
                  ⬚
                </button>
                <button type="button" className={"viewbtn " + (view === "list" ? "active" : "")} onClick={() => setView("list")}>
                  ☰
                </button>
              </div>
            </div>

            <div className={"products3-grid " + (view === "list" ? "list" : "grid")} role="list">
              {loading ? (
                Array.from({ length: skeletonCount }).map((_, idx) => (
                  <div key={idx} className={"pcard pcard-skeleton " + (view === "list" ? "list" : "grid")} role="listitem" />
                ))
              ) : error ? (
                <div className="card pad" style={{ gridColumn: "1 / -1" }}>
                  <EmptyState
                    icon="📡"
                    title="Gagal memuat"
                    description={error}
                    primaryAction={{ label: "Refresh", onClick: () => window.location.reload() }}
                  />
                </div>
              ) : filtered.length === 0 ? (
                <div className="card pad" style={{ gridColumn: "1 / -1" }}>
                  <EmptyState
                    icon="🤔"
                    title="Tidak ditemukan"
                    description={query ? `Tidak ada produk untuk "${query}".` : "Coba ubah filter atau reset."}
                    primaryAction={{ label: "Reset Filter", onClick: resetFilters }}
                  />
                </div>
              ) : (
                filtered.map((p) => {
                  const stock = Number(p._stock || 0);
                  const sold = Number(p._sold || 0);
                  const low = stock > 0 && stock <= 5;
                  const hot = sold >= 10;
                  const hasIcon = Boolean(p.icon_url);

                  return (
                    <Link
                      key={p.id}
                      to={`/produk/${p.slug}`}
                      className={"pcard " + (view === "list" ? "list" : "grid")}
                      role="listitem"
                      aria-label={`Buka detail ${p.name}`}
                    >
                      <div className="pcard-icon">
                        {hasIcon ? (
                          <img src={p.icon_url} alt="" loading="lazy" />
                        ) : (
                          <div className="pcard-fallback" aria-hidden="true">
                            {String(p?.name || "P").slice(0, 1).toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className="pcard-body">
                        <div className="pcard-top">
                          <div className="pcard-title">{p.name}</div>
                          <div className="pcard-badges" aria-label="Badge">
                            {hot ? <span className="badge hot">🔥 Terlaris</span> : null}
                            {low ? <span className="badge low">⚠️ Stok {stock}</span> : null}
                            {!stock ? <span className="badge out">⛔ Habis</span> : null}
                          </div>
                        </div>

                        <div className="pcard-desc">
                          {p.description ? p.description : "Klik untuk lihat paket & durasi."}
                        </div>

                        <div className="pcard-meta">
                          <span className="meta-pill">Mulai {p._minPrice ? formatIDR(p._minPrice) : "—"}</span>
                          <span className="meta-pill">Varian {p._vars?.length || 0}</span>
                          <span className="meta-pill">Stok {stock}</span>
                        </div>
                      </div>

                      <div className="pcard-cta" aria-hidden="true">
                        <span>Lihat detail</span>
                        <span className="pcard-arrow">→</span>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Mobile filters drawer */}
      {filtersOpen ? (
        <div className="pfilters-backdrop" onMouseDown={() => setFiltersOpen(false)} role="presentation">
          <div className="pfilters-sheet" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Filter produk">
            <div className="pfilters-sheetHead">
              <div>
                <div className="pfilters-sheetTitle">Filter</div>
                <div className="hint subtle">Atur kategori, harga, urutan, dan tampilan.</div>
              </div>
              <button className="icon-btn" type="button" onClick={() => setFiltersOpen(false)} aria-label="Tutup">
                ✕
              </button>
            </div>

            <div className="pfilters-sheetBody">
              <FilterPanel
                compact
                query={query}
                setQuery={setQuery}
                cats={cats}
                toggleCat={toggleCat}
                inStockOnly={inStockOnly}
                setInStockOnly={setInStockOnly}
                priceBounds={priceBounds}
                price={price}
                setPrice={setPrice}
                sort={sort}
                setSort={setSort}
                view={view}
                setView={setView}
                onReset={resetFilters}
              />
            </div>

            <div className="pfilters-sheetFoot">
              <button type="button" className="btn btn-wide" onClick={() => setFiltersOpen(false)}>
                Terapkan
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {cartItemCount > 0 && (
        <div className="sticky-cta">
          <div className="sticky-cta-left">
            <div className="sticky-cta-title">Keranjang</div>
            <div className="sticky-cta-value">
              {cartItemCount} item • {formatIDR(subtotal())}
            </div>
          </div>
          <Link className="btn" to="/checkout">
            Checkout
          </Link>
        </div>
      )}
    </div>
  );
}
