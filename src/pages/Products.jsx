import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Blocks,
  CircleAlert,
  Film,
  Flame,
  GraduationCap,
  Grid2x2,
  List,
  Music4,
  Package2,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";

import { fetchProducts } from "../lib/api";
import EmptyState from "../components/EmptyState";
import { usePageMeta } from "../hooks/usePageMeta";
import { useCart } from "../context/CartContext";
import { formatIDR } from "../lib/format";

const CATEGORIES = [
  { key: "streaming", label: "Streaming", icon: Film },
  { key: "music", label: "Music", icon: Music4 },
  { key: "tools", label: "Tools", icon: Blocks },
  { key: "learning", label: "Belajar", icon: GraduationCap },
  { key: "other", label: "Lainnya", icon: Sparkles },
];

function inferCategory(product) {
  const explicit = String(product?.category || "").trim().toLowerCase();
  if (explicit) return explicit;
  const blob = `${product?.slug || ""} ${product?.name || ""}`.toLowerCase();
  if (/(netflix|disney|hotstar|prime|viu|vidio|iqiyi|bstation)/.test(blob)) return "streaming";
  if (/(spotify|youtube)/.test(blob)) return "music";
  if (/(canva|capcut|chatgpt|zoom|getcontact)/.test(blob)) return "tools";
  if (/(duolingo)/.test(blob)) return "learning";
  return "other";
}

function clamp(n, min, max) {
  const value = Number(n);
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function formatCompactIDR(n) {
  const value = Number(n || 0);
  if (!Number.isFinite(value)) return "0";
  if (value >= 1000000) return `${Math.round(value / 100000) / 10}jt`;
  if (value >= 1000) return `${Math.round(value / 100) / 10}k`;
  return String(value);
}

function Range({ min, max, valueMin, valueMax, step = 1000, onChange }) {
  const left = max <= min ? 0 : ((valueMin - min) / (max - min)) * 100;
  const right = max <= min ? 100 : ((valueMax - min) / (max - min)) * 100;
  const trackStyle = {
    background: `linear-gradient(90deg, rgba(255,255,255,.12) 0%, rgba(255,255,255,.12) ${left}%, rgba(22,199,166,.78) ${left}%, rgba(22,199,166,.78) ${right}%, rgba(255,255,255,.12) ${right}%, rgba(255,255,255,.12) 100%)`,
  };

  return (
    <div className="catalog-range" aria-label="Filter harga">
      <div className="catalog-rangeTrack" style={trackStyle} />
      <input
        className="catalog-rangeInput is-min"
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
        className="catalog-rangeInput is-max"
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

      <div className="catalog-rangeValues">
        <span>{formatCompactIDR(valueMin)}</span>
        <span>-</span>
        <span>{formatCompactIDR(valueMax)}</span>
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
    <div className={`catalog-filter ${compact ? "compact" : ""}`}>
      <div className="catalog-filterBlock">
        <div className="catalog-filterLabel">Cari</div>
        <div className="catalog-filterSearch">
          <Search size={15} />
          <input
            className="input catalog-filterInput"
            value={query}
            placeholder="Netflix, Canva, ChatGPT"
            onChange={(e) => setQuery(e.target.value)}
          />
          {query ? (
            <button type="button" className="catalog-filterClear" onClick={() => setQuery("")} aria-label="Hapus">
              <X size={14} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="catalog-filterBlock">
        <div className="catalog-filterLabel">Kategori</div>
        <div className="catalog-chipGrid">
          {CATEGORIES.map((category) => {
            const Icon = category.icon;
            const active = cats.includes(category.key);
            return (
              <button
                key={category.key}
                type="button"
                className={`catalog-chip ${active ? "active" : ""}`}
                onClick={() => toggleCat(category.key)}
                aria-pressed={active}
              >
                <Icon size={14} />
                <span>{category.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="catalog-filterBlock">
        <div className="catalog-filterRow">
          <span className="catalog-filterLabel">Ready</span>
          <label className="catalog-toggle">
            <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} />
            <span className="catalog-toggleUi" aria-hidden="true" />
          </label>
        </div>
      </div>

      <div className="catalog-filterBlock">
        <div className="catalog-filterLabel">Harga</div>
        <Range
          min={priceBounds.min}
          max={priceBounds.max}
          valueMin={price.min}
          valueMax={price.max}
          step={1000}
          onChange={(next) => setPrice(next)}
        />
      </div>

      <div className="catalog-filterBlock">
        <div className="catalog-filterLabel">Urutkan</div>
        <select className="input catalog-filterSelect" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="reco">Rekomendasi</option>
          <option value="popular">Terlaris</option>
          <option value="price_asc">Harga termurah</option>
          <option value="price_desc">Harga termahal</option>
          <option value="stock_desc">Stok terbanyak</option>
          <option value="name">Nama A-Z</option>
        </select>
      </div>

      <div className="catalog-filterBlock">
        <div className="catalog-filterLabel">Tampilan</div>
        <div className="catalog-viewSwitch">
          <button
            type="button"
            className={`catalog-viewBtn ${view === "grid" ? "active" : ""}`}
            onClick={() => setView("grid")}
            aria-pressed={view === "grid"}
          >
            <Grid2x2 size={15} />
            <span>Grid</span>
          </button>
          <button
            type="button"
            className={`catalog-viewBtn ${view === "list" ? "active" : ""}`}
            onClick={() => setView("list")}
            aria-pressed={view === "list"}
          >
            <List size={15} />
            <span>List</span>
          </button>
        </div>
      </div>

      <div className="catalog-filterBlock no-border">
        <button type="button" className="btn btn-ghost btn-wide" onClick={onReset}>
          Reset
        </button>
      </div>
    </div>
  );
}

export default function Products() {
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState("");
  const [cats, setCats] = useState([]);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState("reco");
  const [view, setView] = useState("grid");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [price, setPrice] = useState({ min: 0, max: 0 });
  const [priceReady, setPriceReady] = useState(false);

  const qParam = params.get("q") || "";
  const [query, setQuery] = useState(qParam);
  const searchRef = useRef(null);

  const { items, subtotal } = useCart();
  const cartItemCount = items?.reduce((sum, item) => sum + (item.qty || 0), 0) || 0;

  usePageMeta({
    title: "Produk",
    description: "Katalog produk dengan filter cepat dan paket yang mudah dipilih.",
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

  useEffect(() => {
    const next = String(query || "").trim();
    const current = params.get("q") || "";
    if (next === current) return;

    if (!next) {
      params.delete("q");
      setParams(params, { replace: true });
      return;
    }

    params.set("q", next);
    setParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

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
    return (products || []).map((product) => {
      const vars = (product?.product_variants || [])
        .slice()
        .filter((variant) => variant?.is_active)
        .sort((a, b) => (a?.sort_order || 0) - (b?.sort_order || 0));

      const prices = vars
        .map((variant) => Number(variant?.price_idr || 0))
        .filter((value) => Number.isFinite(value) && value > 0);

      return {
        ...product,
        _vars: vars,
        _minPrice: prices.length ? Math.min(...prices) : 0,
        _maxPrice: prices.length ? Math.max(...prices) : 0,
        _stock: vars.reduce((sum, variant) => sum + Number(variant?.stock || 0), 0),
        _sold: vars.reduce((sum, variant) => sum + Number(variant?.sold_count || 0), 0),
        _category: inferCategory(product),
      };
    });
  }, [products]);

  const priceBounds = useMemo(() => {
    const prices = enriched.map((item) => item._minPrice).filter((value) => Number.isFinite(value) && value > 0);
    if (!prices.length) return { min: 0, max: 0 };
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }, [enriched]);

  useEffect(() => {
    if (!priceReady && priceBounds.max > 0) {
      setPrice({ min: priceBounds.min, max: priceBounds.max });
      setPriceReady(true);
    }
  }, [priceBounds.min, priceBounds.max, priceReady]);

  useEffect(() => {
    if (!priceReady) return;
    setPrice((prev) => ({
      min: clamp(prev.min, priceBounds.min, priceBounds.max),
      max: clamp(prev.max, priceBounds.min, priceBounds.max),
    }));
  }, [priceBounds.min, priceBounds.max, priceReady]);

  function toggleCat(key) {
    setCats((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
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
    let list = (enriched || []).filter((item) => item?.is_active);

    if (cats.length) list = list.filter((item) => cats.includes(item._category));
    if (inStockOnly) list = list.filter((item) => Number(item._stock || 0) > 0);

    if (priceBounds.max > 0) {
      list = list.filter((item) => {
        const minPrice = Number(item._minPrice || 0);
        if (!minPrice) return true;
        return minPrice >= price.min && minPrice <= price.max;
      });
    }

    if (s) {
      list = list.filter((item) => {
        const name = String(item?.name || "").toLowerCase();
        const slug = String(item?.slug || "").replace(/-/g, " ").toLowerCase();
        const desc = String(item?.description || "").toLowerCase();
        const variants = (item?._vars || [])
          .map((variant) => `${variant?.name || ""} ${variant?.duration_label || ""}`.toLowerCase())
          .join(" ");
        return name.includes(s) || slug.includes(s) || desc.includes(s) || variants.includes(s);
      });
    }

    const byName = (a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), "id");
    const byReco = (a, b) => (a?.sort_order || 0) - (b?.sort_order || 0);
    const byPopular = (a, b) => (b?._sold || 0) - (a?._sold || 0) || byReco(a, b);
    const byPriceAsc = (a, b) => (a?._minPrice || 0) - (b?._minPrice || 0) || byReco(a, b);
    const byPriceDesc = (a, b) => (b?._minPrice || 0) - (a?._minPrice || 0) || byReco(a, b);
    const byStockDesc = (a, b) => (b?._stock || 0) - (a?._stock || 0) || byReco(a, b);

    const sorted = list.slice();
    if (sort === "popular") sorted.sort(byPopular);
    else if (sort === "price_asc") sorted.sort(byPriceAsc);
    else if (sort === "price_desc") sorted.sort(byPriceDesc);
    else if (sort === "stock_desc") sorted.sort(byStockDesc);
    else if (sort === "name") sorted.sort(byName);
    else sorted.sort(byReco);
    return sorted;
  }, [cats, enriched, inStockOnly, price.max, price.min, priceBounds.max, query, sort]);

  const activeFiltersCount =
    (query ? 1 : 0) +
    (cats.length ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (priceReady && (price.min !== priceBounds.min || price.max !== priceBounds.max) ? 1 : 0) +
    (sort !== "reco" ? 1 : 0);

  const skeletonCount = view === "list" ? 6 : 8;

  return (
    <div className={cartItemCount > 0 ? "page with-sticky-cta" : "page"}>
      <section className="section catalog-hero reveal">
        <div className="container">
          <div className="catalog-heroGrid">
            <div>
              <div className="catalog-eyebrow">Katalog produk</div>
              <h1 className="h1 catalog-title">Cari yang cocok.</h1>
              <p className="catalog-sub">Filter cepat. Harga jelas. Masuk ke paket dalam satu tap.</p>
            </div>
          </div>

          <div className="catalog-command">
            <div className="catalog-commandSearch">
              <Search size={16} className="catalog-commandIcon" />
              <input
                ref={searchRef}
                className="input catalog-commandInput"
                value={query}
                placeholder="Cari produk, varian, atau durasi"
                onChange={(e) => setQuery(e.target.value)}
              />
              {query ? (
                <button
                  className="catalog-commandClear"
                  onClick={() => setQuery("")}
                  type="button"
                  aria-label="Hapus pencarian"
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>

            <div className="catalog-commandActions">
              <select className="input catalog-commandSort" value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="reco">Rekomendasi</option>
                <option value="popular">Terlaris</option>
                <option value="price_asc">Harga termurah</option>
                <option value="price_desc">Harga termahal</option>
                <option value="stock_desc">Stok terbanyak</option>
                <option value="name">Nama A-Z</option>
              </select>

              <button
                type="button"
                className="btn btn-ghost catalog-filterBtn"
                onClick={() => setFiltersOpen(true)}
              >
                <SlidersHorizontal size={16} />
                <span>Filter</span>
                {activeFiltersCount ? <span className="catalog-filterBtnCount">{activeFiltersCount}</span> : null}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="section reveal" style={{ paddingTop: 0 }}>
        <div className="container catalog-layout">
          <aside className="catalog-sidebar" aria-label="Filter produk">
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

          <div className="catalog-content">
            <div className="catalog-contentBar">
              <div className="catalog-contentMeta">
                <strong>{loading ? "..." : filtered.length}</strong>
                <span>produk</span>
              </div>

              <div className="catalog-contentActions">
                <button
                  type="button"
                  className={`catalog-viewBtn ${view === "grid" ? "active" : ""}`}
                  onClick={() => setView("grid")}
                  aria-label="Grid"
                >
                  <Grid2x2 size={15} />
                </button>
                <button
                  type="button"
                  className={`catalog-viewBtn ${view === "list" ? "active" : ""}`}
                  onClick={() => setView("list")}
                  aria-label="List"
                >
                  <List size={15} />
                </button>
              </div>
            </div>

            <div className={`catalog-grid ${view === "list" ? "list" : "grid"}`} role="list">
              {loading ? (
                Array.from({ length: skeletonCount }).map((_, idx) => (
                  <div key={idx} className={`catalog-cardSkeleton ${view === "list" ? "list" : "grid"}`} role="listitem" />
                ))
              ) : error ? (
                <div className="card pad" style={{ gridColumn: "1 / -1" }}>
                  <EmptyState
                    icon="!"
                    title="Gagal memuat"
                    description={error}
                    primaryAction={{ label: "Refresh", onClick: () => window.location.reload() }}
                  />
                </div>
              ) : filtered.length === 0 ? (
                <div className="card pad" style={{ gridColumn: "1 / -1" }}>
                  <EmptyState
                    icon="-"
                    title="Tidak ditemukan"
                    description={query ? `Tidak ada produk untuk "${query}".` : "Coba ubah filter atau reset."}
                    primaryAction={{ label: "Reset Filter", onClick: resetFilters }}
                  />
                </div>
              ) : (
                filtered.map((product) => {
                  const stock = Number(product._stock || 0);
                  const sold = Number(product._sold || 0);
                  const low = stock > 0 && stock <= 5;
                  const hot = sold >= 10;
                  const displayPrice = product._minPrice ? formatIDR(product._minPrice) : "-";

                  return (
                    <Link
                      key={product.id}
                      to={`/produk/${product.slug}`}
                      className={`catalog-card ${view === "list" ? "list" : "grid"}`}
                      role="listitem"
                      aria-label={`Buka detail ${product.name}`}
                    >
                      <div className="catalog-cardCover">
                        <div className="catalog-cardIcon">
                          {product.icon_url ? (
                            <img src={product.icon_url} alt="" loading="lazy" />
                          ) : (
                            <span>{String(product?.name || "P").slice(0, 1).toUpperCase()}</span>
                          )}
                        </div>

                        <div className="catalog-cardStatus">
                          {hot ? (
                            <span className="catalog-status hot">
                              <Flame size={13} />
                              <span>Hot</span>
                            </span>
                          ) : null}
                          {low ? (
                            <span className="catalog-status warn">
                              <CircleAlert size={13} />
                              <span>{stock}</span>
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="catalog-cardBody">
                        <div className="catalog-cardHead">
                          <div>
                            <div className="catalog-cardTitle">{product.name}</div>
                          </div>
                          <div className="catalog-cardPrice">{displayPrice}</div>
                        </div>

                        <div className="catalog-cardMeta">
                          <span>
                            <Package2 size={13} />
                            <span>{product._vars?.length || 0} varian</span>
                          </span>
                          <span>
                            <span>{stock}</span>
                            <span>stok</span>
                          </span>
                          <span>
                            <span>{sold}</span>
                            <span>terjual</span>
                          </span>
                        </div>

                        <div className="catalog-cardFoot">
                          <span>Lihat paket</span>
                          <ArrowRight size={15} />
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </section>

      {filtersOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="catalog-sheetBackdrop" onMouseDown={() => setFiltersOpen(false)} role="presentation">
              <div className="catalog-sheet" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Filter produk">
                <div className="catalog-sheetHandle" aria-hidden="true" />
                <div className="catalog-sheetHead">
                  <div>
                    <div className="catalog-sheetTitle">Filter produk</div>
                    <div className="catalog-sheetSub">Sapu, pilih, lalu lanjut.</div>
                  </div>
                  <button className="catalog-sheetClose" type="button" onClick={() => setFiltersOpen(false)} aria-label="Tutup">
                    <X size={18} />
                  </button>
                </div>

                <div className="catalog-sheetBody">
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

                <div className="catalog-sheetFoot">
                  <button type="button" className="btn btn-wide" onClick={() => setFiltersOpen(false)}>
                    Terapkan
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {cartItemCount > 0 ? (
        <div className="sticky-cta">
          <div className="sticky-cta-left">
            <div className="sticky-cta-title">Keranjang</div>
            <div className="sticky-cta-value">
              {cartItemCount} item | {formatIDR(subtotal())}
            </div>
          </div>
          <Link className="btn" to="/checkout" state={{ backgroundLocation: location }}>
            Checkout
          </Link>
        </div>
      ) : null}
    </div>
  );
}
