import React, { useCallback, useEffect, useId, useMemo, useRef, useState, memo } from "react";
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
  Layers3,
  List,
  Music4,
  PackageCheck,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";

import { fetchProducts } from "../lib/api";
import { warn } from "../lib/log";
import CatalogCardSkeleton from "../components/CatalogCardSkeleton";
import CatalogFilterSidebar from "../components/CatalogFilterSidebar";
import EmptyState from "../components/EmptyState";
import FlashSaleBanner from "../components/FlashSaleBanner";
import NumberCounter from "../components/NumberCounter";

import { usePageMeta } from "../hooks/usePageMeta";
import { useCart } from "../context/CartContext";
import { formatIDR, summarizeCatalogCopy, detectAccountTypes } from "../lib/format";
import { buildStoreInsights } from "../lib/storeInsights";
import { useDialogA11y } from "../hooks/useDialogA11y";
import { useDebounce } from "../hooks/useDebounce";
import { saveScrollY, consumeSavedScrollY } from "../hooks/useScrollMemory";
import TypewriterSearchInput from "../components/TypewriterSearchInput";
import "../css/pages/Products.css";

const CATEGORIES = [
  { key: "streaming", label: "Streaming", icon: Film },
  { key: "music", label: "Music", icon: Music4 },
  { key: "tools", label: "Tools", icon: Blocks },
  { key: "learning", label: "Belajar", icon: GraduationCap },
  { key: "other", label: "Lainnya", icon: Sparkles },
];

const DAY_MS = 24 * 60 * 60 * 1000;
// "Produk baru" = ditambahkan dalam N hari terakhir.
const NEW_PRODUCT_DAYS = 30;
// "Baru di stok" = varian in-stock yang terakhir di-update dalam N hari terakhir.
const RESTOCK_DAYS = 7;
const SORT_LABELS = {
  name: "Nama A-Z",
  name_desc: "Nama Z-A",
  reco: "Rekomendasi",
  popular: "Best Seller",
  price_asc: "Termurah",
  price_desc: "Termahal",
  stock_desc: "Stok Terbanyak",
};

const DEFAULT_SORT = "reco";

const SEARCH_QUERIES = [
  "Netflix Premium",
  "Spotify Family",
  "YouTube Premium",
  "Canva Pro",
  "ChatGPT Plus",
  "Disney+ Hotstar",
];

function inferCategory(product) {
  const explicit = String(product?.category || "").trim().toLowerCase();
  return explicit || "other";
}

function clamp(n, min, max) {
  const value = Number(n);
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function toTime(value) {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
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
  cats,
  toggleCat,
  inStockOnly,
  setInStockOnly,
  newOnly,
  setNewOnly,
  restockOnly,
  setRestockOnly,
  priceBounds,
  price,
  setPrice,
  sort,
  setSort,
  view,
  setView,
  onReset,
  variant = "sidebar",
  showViewToggle = true,
  showReset = true,
  idPrefix = "",
  categoryCounts = {},
}) {
  const generatedPrefix = useId().replace(/:/g, "");
  const prefix = idPrefix || `catalog-${generatedPrefix}`;
  const readyToggleId = `${prefix}-ready`;
  const newToggleId = `${prefix}-new`;
  const restockToggleId = `${prefix}-restock`;
  const isSheet = variant === "sheet";

  return (
    <div className={`catalog-filter ${isSheet ? "is-sheet" : "is-sidebar"}`}>
      <section className="catalog-filterSection">
        <header className="catalog-filterSectionHead">
          <span className="catalog-filterLabel">Kategori</span>
        </header>
        <div className="catalog-chipGrid">
          {CATEGORIES.map((category) => {
            const Icon = category.icon;
            const active = cats.includes(category.key);
            const count = categoryCounts[category.key] || 0;
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
                {count > 0 && <span className="catalog-chip-count">{count}</span>}
              </button>
            );
          })}
        </div>
      </section>

      <section className="catalog-filterSection" style={{ "--section-i": 1 }}>
        <header className="catalog-filterSectionHead">
          <span className="catalog-filterLabel">Status</span>
        </header>
        <div className="catalog-toggleGroup">
          <label className="catalog-toggleItem" htmlFor={readyToggleId}>
            <span className="catalog-toggleItemText">
              <span className="catalog-toggleItemTitle">Ready</span>
              <span className="catalog-toggleItemHint">Stok aman, gas!</span>
            </span>
            <span className="catalog-toggle">
              <input
                id={readyToggleId}
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
              />
              <span className="catalog-toggleUi" aria-hidden="true" />
            </span>
          </label>

          <label className="catalog-toggleItem" htmlFor={newToggleId}>
            <span className="catalog-toggleItemText">
              <span className="catalog-toggleItemTitle">Baru rilis</span>
              <span className="catalog-toggleItemHint">{`Rilis ${NEW_PRODUCT_DAYS} hari terakhir`}</span>
            </span>
            <span className="catalog-toggle">
              <input id={newToggleId} type="checkbox" checked={newOnly} onChange={(e) => setNewOnly(e.target.checked)} />
              <span className="catalog-toggleUi" aria-hidden="true" />
            </span>
          </label>

          <label className="catalog-toggleItem" htmlFor={restockToggleId}>
            <span className="catalog-toggleItemText">
              <span className="catalog-toggleItemTitle">Baru di stok</span>
              <span className="catalog-toggleItemHint">{`Restock ${RESTOCK_DAYS} hari terakhir`}</span>
            </span>
            <span className="catalog-toggle">
              <input
                id={restockToggleId}
                type="checkbox"
                checked={restockOnly}
                onChange={(e) => setRestockOnly(e.target.checked)}
              />
              <span className="catalog-toggleUi" aria-hidden="true" />
            </span>
          </label>
        </div>
      </section>

      <section className="catalog-filterSection" style={{ "--section-i": 2 }}>
        <header className="catalog-filterSectionHead">
          <span className="catalog-filterLabel">Harga</span>
        </header>
        <Range
          min={priceBounds.min}
          max={priceBounds.max}
          valueMin={price.min}
          valueMax={price.max}
          step={1000}
          onChange={(next) => setPrice(next)}
        />
      </section>

      <section className="catalog-filterSection" style={{ "--section-i": 3 }}>
        <header className="catalog-filterSectionHead">
          <span className="catalog-filterLabel">Urutin</span>
        </header>
        <select className="input catalog-filterSelect" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="name">Nama A-Z</option>
          <option value="name_desc">Nama Z-A</option>
          <option value="reco">Rekomendasi</option>
          <option value="popular">Best Seller</option>
          <option value="price_asc">Termurah</option>
          <option value="price_desc">Termahal</option>
          <option value="stock_desc">Stok Terbanyak</option>
        </select>
      </section>

      {showViewToggle ? (
        <section className="catalog-filterSection catalog-filterSection--view" style={{ "--section-i": 4 }}>
          <header className="catalog-filterSectionHead">
            <span className="catalog-filterLabel">Tampilan</span>
          </header>
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
        </section>
      ) : null}

      {showReset ? (
        <div className="catalog-filterResetRow">
          <button type="button" className="btn btn-ghost btn-wide" onClick={onReset}>
            Reset
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function Products() {
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState("");
  const [cats, setCats] = useState(() => (params.get("cats") ? params.get("cats").split(",") : []));
  const [inStockOnly, setInStockOnly] = useState(() => params.get("ready") === "1");
  const [newOnly, setNewOnly] = useState(() => params.get("new") === "1");
  const [restockOnly, setRestockOnly] = useState(() => params.get("restock") === "1");
  const [sort, setSort] = useState(() => params.get("sort") || DEFAULT_SORT);
  const [view, setView] = useState(() => params.get("view") || "grid");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtersSheetMounted, setFiltersSheetMounted] = useState(false);
  const [filtersSheetVisible, setFiltersSheetVisible] = useState(false);
  const [price, setPrice] = useState({
    min: Number(params.get("pmin")) || 0,
    max: Number(params.get("pmax")) || 0,
  });
  const [localPrice, setLocalPrice] = useState(price);
  const [priceReady, setPriceReady] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const prevFilterSigRef = useRef("");
  const pendingScrollRef = useRef(null);

  const qParam = params.get("q") || "";
  const [query, setQuery] = useState(qParam);
  const debouncedQuery = useDebounce(query, 300);
  const searchRef = useRef(null);
  const searchWrapRef = useRef(null);
  const sheetRef = useRef(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const catalogListboxId = "catalog-search-listbox";

  const { items, subtotal } = useCart();
  const cartItemCount = items?.reduce((sum, item) => sum + (item.qty || 0), 0) || 0;
  const [viewMorph, setViewMorph] = useState(false);
  const prevViewRef = useRef(view);
  const openFilters = useCallback(() => setFiltersOpen(true), []);
  const closeFilters = useCallback(() => setFiltersOpen(false), []);

  // Scroll memory: capture position immediately on product link click (before navigation).
  // Click fires synchronously, so scrollY is guaranteed correct at the moment of interaction.
  // Also saves on scroll as fallback for non-click navigation (e.g., browser back into Products).
  useEffect(() => {
    const onClick = (e) => {
      if (e.target.closest('a[href^="/produk/"]')) saveScrollY();
    };
    window.addEventListener("click", onClick, { capture: true, passive: true });
    return () => window.removeEventListener("click", onClick, { capture: true });
  }, []);

  // Deferred scroll restoration: wait for products + DOM to fully settle
  useEffect(() => {
    if (pendingScrollRef.current === null) return;
    if (loading || isFiltering) return;
    const y = pendingScrollRef.current;
    pendingScrollRef.current = null;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: y, behavior: "auto" });
      });
    });
  }, [loading, isFiltering]);

  useEffect(() => {
    if (filtersOpen) {
      setFiltersSheetMounted(true);
      const raf = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setFiltersSheetVisible(true));
      });
      return () => window.cancelAnimationFrame(raf);
    }

    setFiltersSheetVisible(false);
    const timer = window.setTimeout(() => setFiltersSheetMounted(false), 320);
    return () => window.clearTimeout(timer);
  }, [filtersOpen]);

  useEffect(() => {
    if (!filtersSheetMounted || typeof document === "undefined") return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [filtersSheetMounted]);

  useDialogA11y({
    open: filtersSheetMounted && filtersSheetVisible,
    containerRef: sheetRef,
    onClose: closeFilters,
    initialFocusSelector: ".catalog-sheetClose",
  });

  usePageMeta({
    title: "Produk",
    description: "Katalog langganan premium — cari, bandingin, langsung checkout.",
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
        warn(e);
        if (!alive) return;
        setError("Gagal load produk.");
      } finally {
        if (alive) {
          setLoading(false);
          const savedY = consumeSavedScrollY();
          if (savedY !== null) pendingScrollRef.current = savedY;
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // URL Sync Effect moved below priceBounds

  useEffect(() => {
    if (!query.trim()) {
      setSearchSuggestions([]);
      return;
    }
    const term = query.trim().toLowerCase();
    const words = [];
    (products || []).forEach((product) => {
      if (product?.name) words.push(product.name);
      (product?.product_variants || []).forEach((variant) => {
        if (variant?.name) words.push(`${product.name} – ${variant.name}`);
      });
    });
    const unique = Array.from(new Set(words.map((w) => String(w).trim()).filter(Boolean)));
    setSearchSuggestions(unique.filter((x) => x.toLowerCase().includes(term)).slice(0, 5));
  }, [query, products]);

  useEffect(() => {
    if (activeSuggestionIndex >= searchSuggestions.length) setActiveSuggestionIndex(-1);
  }, [activeSuggestionIndex, searchSuggestions.length]);

  useEffect(() => {
    const onDoc = (e) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) {
        setSearchOpen(false);
        setActiveSuggestionIndex(-1);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (prevViewRef.current === view) return undefined;
    setViewMorph(true);
    const timer = window.setTimeout(() => setViewMorph(false), 300);
    prevViewRef.current = view;
    return () => window.clearTimeout(timer);
  }, [view]);

  const filterSignature = useMemo(
    () =>
      [
        debouncedQuery,
        cats.join(","),
        inStockOnly ? 1 : 0,
        newOnly ? 1 : 0,
        restockOnly ? 1 : 0,
        sort,
        price.min,
        price.max,
        view,
      ].join("|"),
    [debouncedQuery, cats, inStockOnly, newOnly, restockOnly, sort, price.min, price.max, view]
  );

  useEffect(() => {
    if (loading) return undefined;
    if (!prevFilterSigRef.current) {
      prevFilterSigRef.current = filterSignature;
      return undefined;
    }
    if (prevFilterSigRef.current === filterSignature) return undefined;
    prevFilterSigRef.current = filterSignature;
    setIsFiltering(true);
    const timer = window.setTimeout(() => setIsFiltering(false), 140);
    return () => window.clearTimeout(timer);
  }, [filterSignature, loading]);

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

      const latestInStockUpdateTs = vars
        .filter((variant) => Number(variant?.stock || 0) > 0)
        .reduce((maxTs, variant) => {
          const next = Math.max(toTime(variant?.updated_at), toTime(variant?.created_at));
          return next > maxTs ? next : maxTs;
        }, 0);

      return {
        ...product,
        _vars: vars,
        _minPrice: prices.length ? Math.min(...prices) : 0,
        _maxPrice: prices.length ? Math.max(...prices) : 0,
        _stock: vars.reduce((sum, variant) => sum + Number(variant?.stock || 0), 0),
        _sold: vars.reduce((sum, variant) => sum + Number(variant?.sold_count || 0), 0),
        _category: inferCategory(product),
        _createdAtTs: toTime(product?.created_at),
        _latestInStockUpdateTs: latestInStockUpdateTs,
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

  useEffect(() => {
    setLocalPrice((prev) => {
      if (prev.min !== price.min || prev.max !== price.max) {
        return price;
      }
      return prev;
    });
  }, [price]);

  const debouncedPrice = useDebounce(localPrice, 300);
  useEffect(() => {
    setPrice(debouncedPrice);
  }, [debouncedPrice]);

  useEffect(() => {
    const nextParams = new URLSearchParams(params);

    const qNext = String(query || "").trim();
    if (qNext) nextParams.set("q", qNext);
    else nextParams.delete("q");

    if (cats.length) nextParams.set("cats", cats.join(","));
    else nextParams.delete("cats");

    if (inStockOnly) nextParams.set("ready", "1");
    else nextParams.delete("ready");

    if (newOnly) nextParams.set("new", "1");
    else nextParams.delete("new");

    if (restockOnly) nextParams.set("restock", "1");
    else nextParams.delete("restock");

    if (sort !== DEFAULT_SORT) nextParams.set("sort", sort);
    else nextParams.delete("sort");

    if (view !== "grid") nextParams.set("view", view);
    else nextParams.delete("view");

    if (priceReady && priceBounds.max > 0) {
      if (price.min > priceBounds.min) nextParams.set("pmin", price.min);
      else nextParams.delete("pmin");
      if (price.max < priceBounds.max) nextParams.set("pmax", price.max);
      else nextParams.delete("pmax");
    }

    setParams(nextParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, cats, inStockOnly, newOnly, restockOnly, sort, view, price, priceReady, priceBounds]);

  function toggleCat(key) {
    setCats((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  }

  function setSoloCategory(key) {
    setCats((prev) => (prev.length === 1 && prev[0] === key ? [] : [key]));
  }

  const applyBudgetCap = useCallback((cap) => {
    if (priceBounds.max <= 0) return;
    setPrice({
      min: priceBounds.min,
      max: Math.max(priceBounds.min, Math.min(priceBounds.max, cap)),
    });
  }, [priceBounds.max, priceBounds.min]);

  function resetFilters() {
    setQuery("");
    setCats([]);
    setInStockOnly(false);
    setNewOnly(false);
    setRestockOnly(false);
    setSort(DEFAULT_SORT);
    setView("grid");
    if (priceBounds.max > 0) setPrice({ min: priceBounds.min, max: priceBounds.max });
  }

  const filtered = useMemo(() => {
    const s = String(debouncedQuery || "").trim().toLowerCase();
    const now = Date.now();
    const newCutoff = now - NEW_PRODUCT_DAYS * DAY_MS;
    const restockCutoff = now - RESTOCK_DAYS * DAY_MS;
    let list = (enriched || []).filter((item) => item?.is_active);

    if (cats.length) list = list.filter((item) => cats.includes(item._category));
    if (inStockOnly) list = list.filter((item) => Number(item._stock || 0) > 0);
    if (newOnly) list = list.filter((item) => Number(item._createdAtTs || 0) >= newCutoff);
    if (restockOnly) list = list.filter((item) => Number(item._latestInStockUpdateTs || 0) >= restockCutoff);

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
    const byNameDesc = (a, b) => String(b?.name || "").localeCompare(String(a?.name || ""), "id");
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
    else if (sort === "name_desc") sorted.sort(byNameDesc);
    else if (sort === "reco") sorted.sort(byReco);
    else sorted.sort(byName);
    return sorted;
  }, [cats, enriched, inStockOnly, newOnly, price.max, price.min, priceBounds.max, debouncedQuery, restockOnly, sort]);

  const activeFiltersCount =
    (query ? 1 : 0) +
    (cats.length ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (newOnly ? 1 : 0) +
    (restockOnly ? 1 : 0) +
    (priceReady && (price.min !== priceBounds.min || price.max !== priceBounds.max) ? 1 : 0) +
    (sort !== DEFAULT_SORT ? 1 : 0);

  const skeletonCount = view === "list" ? 6 : 8;
  const insights = useMemo(() => buildStoreInsights({ products }), [products]);
  const freshnessCounts = useMemo(() => {
    const now = Date.now();
    const newCutoff = now - NEW_PRODUCT_DAYS * DAY_MS;
    const restockCutoff = now - RESTOCK_DAYS * DAY_MS;
    const active = (enriched || []).filter((item) => item?.is_active);
    return {
      newProducts: active.filter((item) => Number(item?._createdAtTs || 0) >= newCutoff).length,
      restocked: active.filter((item) => Number(item?._latestInStockUpdateTs || 0) >= restockCutoff).length,
    };
  }, [enriched]);
  const quickFilters = useMemo(
    () => [
      {
        key: "popular",
        label: insights.topProduct ? `Best Seller: ${insights.topProduct.name}` : "Urut best seller",
        active: sort === "popular",
        onClick: () => setSort("popular"),
      },
      {
        key: "ready",
        label: `Ready ${insights.readyVariantsCount}`,
        active: inStockOnly,
        onClick: () => setInStockOnly((prev) => !prev),
      },
      {
        key: "new",
        label: freshnessCounts.newProducts ? `Baru rilis ${freshnessCounts.newProducts}` : "Baru rilis",
        active: newOnly,
        action: () => setNewOnly((p) => !p),
      },
      {
        label: freshnessCounts.restocked ? `Restock ${freshnessCounts.restocked}` : "Restock",
        active: restockOnly,
        onClick: () => setRestockOnly((prev) => !prev),
      },
      {
        key: "streaming",
        label: `Streaming ${insights.categoryCounts.streaming || 0}`,
        active: cats.length === 1 && cats[0] === "streaming",
        onClick: () => setSoloCategory("streaming"),
      },
      {
        key: "tools",
        label: `Tools ${insights.categoryCounts.tools || 0}`,
        active: cats.length === 1 && cats[0] === "tools",
        onClick: () => setSoloCategory("tools"),
      },
      {
        key: "budget",
        label: "Di bawah 10rb",
        active: priceReady && price.min === priceBounds.min && price.max <= 10000,
        onClick: () => applyBudgetCap(10000),
      },
    ],
    [
      applyBudgetCap,
      cats,
      inStockOnly,
      insights.categoryCounts.streaming,
      insights.categoryCounts.tools,
      insights.readyVariantsCount,
      insights.topProduct,
      freshnessCounts.newProducts,
      freshnessCounts.restocked,
      price.max,
      price.min,
      priceBounds.min,
      priceReady,
      sort,
      newOnly,
      restockOnly,
    ]
  );

  const activeSummaryTags = useMemo(() => {
    const tags = [];
    const trimmedQuery = String(query || "").trim();

    if (trimmedQuery) {
      const queryPreview = trimmedQuery.length > 20 ? `${trimmedQuery.slice(0, 20).trimEnd()}...` : trimmedQuery;
      tags.push(`Cari: "${queryPreview}"`);
    }

    if (cats.length) {
      const categoryLabels = cats
        .map((key) => CATEGORIES.find((item) => item.key === key)?.label || key)
        .filter(Boolean);
      if (categoryLabels.length <= 2) {
        tags.push(`Kategori: ${categoryLabels.join(", ")}`);
      } else {
        tags.push(`Kategori: ${categoryLabels.slice(0, 2).join(", ")} +${categoryLabels.length - 2}`);
      }
    }

    if (inStockOnly) tags.push("Hanya ready");
    if (newOnly) tags.push(`Produk baru <= ${NEW_PRODUCT_DAYS} hari`);
    if (restockOnly) tags.push(`Restock <= ${RESTOCK_DAYS} hari`);

    if (priceReady && priceBounds.max > 0 && (price.min !== priceBounds.min || price.max !== priceBounds.max)) {
      tags.push(`Harga: ${formatCompactIDR(price.min)}-${formatCompactIDR(price.max)}`);
    }

    if (sort !== DEFAULT_SORT) {
      tags.push(`Urut: ${SORT_LABELS[sort] || sort}`);
    }

    if (view !== "grid") {
      tags.push("Tampilan: List");
    }

    return tags;
  }, [
    cats,
    inStockOnly,
    newOnly,
    restockOnly,
    price.max,
    price.min,
    priceBounds.max,
    priceBounds.min,
    priceReady,
    query,
    sort,
    view,
  ]);

  const emptySuggestions = useMemo(() => {
    const chips = [];

    if (String(query || "").trim()) {
      chips.push({ key: "clear-search", label: "Hapus pencarian", onClick: () => setQuery("") });
    }
    if (inStockOnly) {
      chips.push({ key: "ready-off", label: "Tampilkan semua stok", onClick: () => setInStockOnly(false) });
    }
    if (cats.length) {
      chips.push({ key: "cats-clear", label: "Semua kategori", onClick: () => setCats([]) });
    }
    if (sort !== DEFAULT_SORT) {
      chips.push({ key: "sort-reset", label: "Urut default", onClick: () => setSort(DEFAULT_SORT) });
    }
    if (insights.topProduct?.name) {
      chips.push({
        key: "top-product",
        label: insights.topProduct.name,
        onClick: () => {
          setQuery(insights.topProduct.name);
          setSort("popular");
        },
      });
    }
    chips.push({ key: "streaming", label: "Streaming", onClick: () => setSoloCategory("streaming") });
    chips.push({ key: "reset-all", label: "Reset semua", onClick: resetFilters });
    return chips.slice(0, 5);
    // resetFilters / setSoloCategory are stable handlers; omit to avoid recomputing every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cats.length, inStockOnly, insights.topProduct, query, sort]);

  return (
    <div className={cartItemCount > 0 ? "page with-sticky-cta catalog-page" : "page catalog-page"}>
      <section className="section catalog-hero reveal">
        <div className="container">
          <div className="catalog-heroGrid">
            <div className="catalog-eyebrow">Katalog</div>
            <h1 className="h1 catalog-title">Mau langganan apa hari ini?</h1>
            <p className="catalog-sub">Scroll dulu, gas aja kalo cocok.</p>
          </div>

          <div className="catalog-command">
            <div className="catalog-commandSearch">
              <div className="search-dropdown-anchor" ref={searchWrapRef}>
              <div className="hero-search-shell catalog-heroSearch">
                <span className="hero-search-icon" aria-hidden="true">
                  <Search size={16} />
                </span>
                <TypewriterSearchInput
                  ref={searchRef}
                  className="input hero-search-input"
                  value={query}
                  words={SEARCH_QUERIES}
                  onFocus={() => setSearchOpen(true)}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSearchOpen(true);
                    setActiveSuggestionIndex(-1);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown" && searchSuggestions.length > 0) {
                      e.preventDefault();
                      setSearchOpen(true);
                      setActiveSuggestionIndex((p) => (p >= searchSuggestions.length - 1 ? 0 : p + 1));
                      return;
                    }
                    if (e.key === "ArrowUp" && searchSuggestions.length > 0) {
                      e.preventDefault();
                      setSearchOpen(true);
                      setActiveSuggestionIndex((p) => (p <= 0 ? searchSuggestions.length - 1 : p - 1));
                      return;
                    }
                    if (e.key === "Enter" && searchOpen && activeSuggestionIndex >= 0) {
                      const pick = searchSuggestions[activeSuggestionIndex];
                      if (pick) {
                        e.preventDefault();
                        setQuery(pick);
                        setSearchOpen(false);
                        setActiveSuggestionIndex(-1);
                      }
                    }
                    if (e.key === "Escape") {
                      setSearchOpen(false);
                      setActiveSuggestionIndex(-1);
                    }
                  }}
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={searchOpen && searchSuggestions.length > 0}
                  aria-controls={searchOpen && searchSuggestions.length > 0 ? catalogListboxId : undefined}
                  aria-activedescendant={
                    activeSuggestionIndex >= 0
                      ? `${catalogListboxId}-option-${activeSuggestionIndex}`
                      : undefined
                  }
                  aria-label="Cari produk"
                />
                {query ? (
                  <button
                    className="hero-search-clear"
                    onClick={() => {
                      setQuery("");
                      setSearchOpen(false);
                      setActiveSuggestionIndex(-1);
                    }}
                    type="button"
                    aria-label="Hapus pencarian"
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>
              {searchOpen && searchSuggestions.length > 0 ? (
                <div
                  className="suggestions suggestions--animate catalog-searchSuggestions"
                  role="listbox"
                  id={catalogListboxId}
                >
                  {searchSuggestions.map((sug, idx) => (
                    <button
                      key={sug}
                      id={`${catalogListboxId}-option-${idx}`}
                      type="button"
                      role="option"
                      aria-selected={idx === activeSuggestionIndex}
                      className={`suggestion-item${idx === activeSuggestionIndex ? " is-active" : ""}`}
                      style={{ "--suggest-i": idx }}
                      onMouseEnter={() => setActiveSuggestionIndex(idx)}
                      onClick={() => {
                        setQuery(sug);
                        setSearchOpen(false);
                        setActiveSuggestionIndex(-1);
                      }}
                    >
                      <Search size={13} />
                      <span>{sug}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              </div>
            </div>

            <div className="catalog-commandActions">
              <button
                type="button"
                className="btn btn-ghost catalog-filterBtn"
                onClick={openFilters}
              >
                <SlidersHorizontal size={16} />
                <span>Filter</span>
                {activeFiltersCount ? (
                  <span className="catalog-filterBtnCount" key={activeFiltersCount}>
                    {activeFiltersCount}
                  </span>
                ) : null}
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="container">
        <FlashSaleBanner />
      </div>

      <section className="section catalog-body" style={{ paddingTop: 0 }}>
        <div className="container catalog-layout">
          <CatalogFilterSidebar activeFiltersCount={activeFiltersCount} onReset={resetFilters}>
            <FilterPanel
              idPrefix="catalog-side"
              variant="sidebar"
              showReset={false}
              cats={cats}
              toggleCat={toggleCat}
              inStockOnly={inStockOnly}
              setInStockOnly={setInStockOnly}
              newOnly={newOnly}
              setNewOnly={setNewOnly}
              restockOnly={restockOnly}
              setRestockOnly={setRestockOnly}
              priceBounds={priceBounds}
              price={localPrice}
              setPrice={setLocalPrice}
              sort={sort}
              setSort={setSort}
              view={view}
              setView={setView}
              onReset={resetFilters}
              categoryCounts={insights.categoryCounts}
            />
          </CatalogFilterSidebar>

          <div className="catalog-content">
            <div className="catalog-quickFilters" aria-label="Pilih cepat">
              {quickFilters.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`catalog-quickChip catalog-quickChip--${item.key}${item.active ? " active" : ""}`}
                  onClick={item.onClick}
                  aria-pressed={item.active}
                >
                  {item.label}
                </button>
              ))}

              {activeFiltersCount ? (
                <button type="button" className="catalog-quickChip ghost" onClick={resetFilters}>
                  Reset semua
                </button>
              ) : null}
            </div>

            <div className="catalog-contentBar">
              <div className={`catalog-contentMeta${isFiltering ? " is-filtering" : ""}`}>
                <strong>
                  {loading || isFiltering ? (
                    "..."
                  ) : (
                    <NumberCounter key={filterSignature} value={filtered.length} duration={420} />
                  )}
                </strong>
                <span>produk</span>
                {activeFiltersCount ? <em>{activeFiltersCount} filter aktif</em> : null}
              </div>

              <div className="catalog-contentActions">
                <button
                  type="button"
                  className={`catalog-viewBtn ${view === "grid" ? "active" : ""}`}
                  onClick={() => setView("grid")}
                  aria-label="Grid"
                  aria-pressed={view === "grid"}
                >
                  <Grid2x2 size={15} />
                </button>
                <button
                  type="button"
                  className={`catalog-viewBtn ${view === "list" ? "active" : ""}`}
                  onClick={() => setView("list")}
                  aria-label="List"
                  aria-pressed={view === "list"}
                >
                  <List size={15} />
                </button>
              </div>
            </div>

            {activeSummaryTags.length ? (
              <div className="catalog-activeState" aria-label="Ringkasan filter aktif">
                {activeSummaryTags.map((tag, idx) => (
                  <span key={`${tag}-${idx}`} className="catalog-activeTag">
                    {tag}
                  </span>
                ))}
                {activeFiltersCount ? (
                  <button type="button" className="catalog-activeReset" onClick={resetFilters}>
                    Reset
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="catalog-gridWrap">
            <div
              className={`catalog-grid ${view === "list" ? "list" : "grid"}${!loading && !isFiltering ? " catalog-grid--animate" : ""}${isFiltering ? " is-filtering" : ""}${viewMorph ? " is-view-morph" : ""}`}
              role="list"
              key={loading ? "catalog-loading" : filterSignature}
            >
              {loading || isFiltering ? (
                Array.from({ length: skeletonCount }).map((_, idx) => (
                  <CatalogCardSkeleton key={idx} view={view} />
                ))
              ) : error ? (
                <div className="card pad catalog-emptyResult" style={{ gridColumn: "1 / -1" }}>
                  <EmptyState
                    icon="!"
                    title="Gagal load"
                    description={error}
                    primaryAction={{ label: "Coba ulang", onClick: () => window.location.reload() }}
                    suggestions={[
                      { key: "back", label: "Balik ke Beranda", onClick: () => window.location.href = "/" },
                    ]}
                  />
                </div>
              ) : filtered.length === 0 ? (
                <div className="card pad catalog-emptyResult" style={{ gridColumn: "1 / -1" }}>
                  <EmptyState
                    icon="-"
                    title={query ? `Hasil untuk "${query}"` : "Tidak ditemukan"}
                    description={
                      query
                        ? `Belum nemu "${query}". Coba kata kunci lain atau intip yang lagi viral.`
                        : inStockOnly
                          ? "Belum ada produk yang ready saat ini. Cek lagi nanti, ya!"
                          : "Reset filternya dulu, baru coba lagi."
                    }
                    suggestions={emptySuggestions}
                    primaryAction={{ label: "Reset filter", onClick: resetFilters }}
                  />
                </div>
              ) : (
                <>
                  {filtered.map((product, idx) => (
                    <ProductCardMemo
                      key={product.id}
                      product={product}
                      view={view}
                      location={location}
                      revealIndex={idx}
                    />
                  ))}
                </>
              )}
            </div>
            </div>
          </div>
        </div>
      </section>

      {filtersSheetMounted && typeof document !== "undefined"
        ? createPortal(
            <div
              className={`catalog-sheetBackdrop${filtersSheetVisible ? " is-open" : ""}`}
              onMouseDown={closeFilters}
              role="presentation"
            >
              <div
                ref={sheetRef}
                className={`catalog-sheet${filtersSheetVisible ? " is-open" : ""}`}
                onMouseDown={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Filter produk"
              >
                <div className="catalog-sheetHandle" aria-hidden="true" />
                <div className="catalog-sheetHead">
                  <div className="catalog-sheetHeadCopy">
                    <div className="catalog-sheetTitle">Filter produk</div>
                    <div className="catalog-sheetSub">
                      {activeFiltersCount
                        ? `${activeFiltersCount} filter aktif`
                        : "Atur kategori, status, sama harga"}
                    </div>
                  </div>
                  <button className="catalog-sheetClose" type="button" onClick={closeFilters} aria-label="Tutup">
                    <X size={18} />
                  </button>
                </div>

                <div className="catalog-sheetBody">
                  <FilterPanel
                    idPrefix="catalog-sheet"
                    variant="sheet"
                    showViewToggle={false}
                    showReset={false}
                    cats={cats}
                    toggleCat={toggleCat}
                    inStockOnly={inStockOnly}
                    setInStockOnly={setInStockOnly}
                    newOnly={newOnly}
                    setNewOnly={setNewOnly}
                    restockOnly={restockOnly}
                    setRestockOnly={setRestockOnly}
                    priceBounds={priceBounds}
                    price={localPrice}
                    setPrice={setLocalPrice}
                    sort={sort}
                    setSort={setSort}
                    view={view}
                    setView={setView}
                    onReset={resetFilters}
                    categoryCounts={insights.categoryCounts}
                  />
                </div>

                <div className="catalog-sheetFoot">
                  <button type="button" className="btn btn-ghost catalog-sheetReset" onClick={resetFilters}>
                    Reset
                  </button>
                  <button type="button" className="btn catalog-sheetApply" onClick={closeFilters}>
                    {loading ? "Memuat..." : `Tampilkan ${filtered.length} produk`}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {cartItemCount > 0 && typeof document !== "undefined"
        ? createPortal(
            <div className="sticky-cta">
              <div className="sticky-cta-left">
                <div className="sticky-cta-title">Keranjang</div>
                <div className="sticky-cta-value">
                  <span>{cartItemCount} item</span>
                  <span className="sticky-cta-sep" aria-hidden="true" />
                  <span>{formatIDR(subtotal())}</span>
                </div>
              </div>
              <Link className="btn" to="/checkout" state={{ backgroundLocation: location }}>
                Checkout
              </Link>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

const ProductCardMemo = memo(function ProductCard({ product, view, location, revealIndex = 0 }) {
  const stock = Number(product._stock || 0);
  const sold = Number(product._sold || 0);
  const soldOut = stock <= 0;
  const low = stock > 0 && stock <= 5;
  const hot = sold >= 10;
  const displayPrice = product._minPrice ? formatIDR(product._minPrice) : "-";
  const category = CATEGORIES.find((item) => item.key === product._category);
  const categoryLabel = category?.label || "Digital";
  const CategoryIcon = category?.icon || Sparkles;
  const summaryCopy = summarizeCatalogCopy(product.description);
  const accountTypes = useMemo(() => detectAccountTypes(product._vars || product.product_variants), [product]);

  return (
    <Link
      to={`/produk/${product.slug}`}
      className={`catalog-card catalog-cardV2 ${view === "list" ? "list" : "grid"}`}
      role="listitem"
      aria-label={`Buka detail ${product.name}`}
      style={{ "--reveal-i": revealIndex }}
    >
      <div className="catalog-cardTop">
        <div className="catalog-cardBrand">
          <div className="catalog-cardIcon">
            {product.icon_url ? (
              <img src={product.icon_url} alt="" loading="lazy" decoding="async" />
            ) : (
              <span>{String(product?.name || "P").slice(0, 1).toUpperCase()}</span>
            )}
          </div>

          <div className="catalog-cardCopy">
            <div className="catalog-cardKicker">
              <CategoryIcon size={13} />
              <span>{categoryLabel}</span>
            </div>
            <div className="catalog-cardTitle">{product.name}</div>
            <div className="catalog-cardSummary">{summaryCopy}</div>
          </div>
        </div>

          <div className="catalog-cardPriceWrap">
          <div className="catalog-cardPrice"><span className="catalog-cardPriceLabel">Mulai</span> {displayPrice}</div>
        </div>
      </div>

      <div className="catalog-cardSignals">
        {hot ? (
          <span className="catalog-status hot">
            <Flame size={13} />
            <span>Hot</span>
          </span>
        ) : null}
        {soldOut ? (
          <span className="catalog-status soldout">
            <CircleAlert size={13} />
            <span>Habis</span>
          </span>
        ) : (
          <span className="catalog-status ok">
            <PackageCheck size={13} />
            <span>Stok: {stock}</span>
          </span>
        )}
        {sold > 0 ? (
          <span className="catalog-status muted">
            <span>{sold} terjual</span>
          </span>
        ) : null}
      </div>

      <div className="catalog-cardMeta">
        {accountTypes.map((t) => (
          <span key={t.label} className="catalog-metaType" style={{ "--type-color": t.color }}>
            {t.label}
          </span>
        ))}
        <span>
          <Layers3 size={13} />
          <span>{product._vars?.length || 0} varian</span>
        </span>
        <span>
          <PackageCheck size={13} />
          <span>Stok: {stock}</span>
        </span>
        <span>
          <ShoppingBag size={13} />
          <span>{sold} terjual</span>
        </span>
      </div>

      <div className="catalog-cardFoot">
        <span>Intip paket</span>
        <ArrowRight size={15} />
      </div>
    </Link>
  );
});
