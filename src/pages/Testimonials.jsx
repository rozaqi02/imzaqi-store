import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowUpRight, ChevronLeft, ChevronRight, Grid2x2, ImageOff,
  Images, LayoutGrid, MessageSquareText, Search, Tag, X, ZoomIn,
  BadgeCheck,
} from "lucide-react";
import { fetchTestimonials } from "../lib/api";
import { formatTestimonialDate } from "../lib/format";
import { PRODUCT_CATEGORIES, resolveTestimonialCategory } from "../lib/productCategories";
import { usePageMeta } from "../hooks/usePageMeta";
import { useDialogA11y } from "../hooks/useDialogA11y";
import { buildStoreInsights } from "../lib/storeInsights";
import { warn } from "../lib/log";

function ReviewImage({ src, alt, eager = false, isViewer = false }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [src]);

  return (
    <>
      {!loaded && !failed && (
        isViewer ? (
          <div className="reviews-viewerLoading" aria-hidden="true">
            <span className="reviews-viewerSpinner" />
            <small>Memuat gambar…</small>
          </div>
        ) : (
          <span className="reviews-imagePlaceholder" aria-hidden="true">
            <strong>imzaqi<span>.store</span></strong>
            <small>testimoni pelanggan</small>
          </span>
        )
      )}
      {failed ? (
        <span className="reviews-imageError"><ImageOff size={30} /><span>Gambar belum bisa ditampilkan</span></span>
      ) : (
        <img
          src={src}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          width="400"
          height="300"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </>
  );
}

function parseStructuredCaption(caption) {
  const raw = String(caption || "").trim();
  if (!raw) return {};
  const result = {};
  const ratingMatch = raw.match(/^\[([1-5])\/5\]\s*/);
  let rest = raw;
  if (ratingMatch) {
    result.rating = Number(ratingMatch[1]);
    rest = rest.slice(ratingMatch[0].length);
  }
  const adminMatch = rest.match(/^(.*)\s*·\s*Dari\s+([^(]+?)(?:\s*\(([^)]+)\))?\s*$/i);
  if (adminMatch) {
    result.cleanCaption = adminMatch[1].replace(/^["“]|["”]$/g, "").trim();
    result.customerName = adminMatch[2].trim();
    if (adminMatch[3]) result.productName = adminMatch[3].trim();
    return result;
  }
  const reviewMatch = rest.match(/^"([^"]+)"\s*,\s*([^()]+?)(?:\s*\(#([A-Z0-9-]+)\))?\s*$/i);
  if (reviewMatch) {
    result.cleanCaption = reviewMatch[1].trim();
    result.customerName = reviewMatch[2].trim();
    return result;
  }
  return result;
}

function enrichTestimonial(item) {
  if (!item || typeof item !== "object") return item;
  const parsed = parseStructuredCaption(item.caption);
  const productName = String(item.product_name || parsed.productName || "").trim();
  const categoryMeta = resolveTestimonialCategory({
    ...item,
    product_name: productName,
  });

  return {
    ...item,
    display_caption: parsed.cleanCaption || String(item.caption || "").trim(),
    product_name: productName,
    customer_name: String(item.customer_name || parsed.customerName || "").trim(),
    rating: Number(item.rating || parsed.rating || 0) || null,
    category_meta: categoryMeta,
    category_key: categoryMeta?.key || "uncategorized",
    category_label: categoryMeta?.label || "",
  };
}

export default function Testimonials() {
  const [searchParams] = useSearchParams();
  const initialCategoryParam = String(searchParams.get("kategori") || "").trim().toLowerCase();
  const initialProductParam = String(searchParams.get("produk") || "").trim();
  const hasValidInitialCategory =
    initialCategoryParam === "uncategorized" ||
    PRODUCT_CATEGORIES.some((cat) => cat.key === initialCategoryParam);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [q, setQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(
    hasValidInitialCategory ? initialCategoryParam : "all"
  );
  const [productFilter, setProductFilter] = useState(initialProductParam || "all");
  const [view, setView] = useState("grid");
  const [limit, setLimit] = useState(9);
  const [activeIdx, setActiveIdx] = useState(-1);
  const dialogRef = useRef(null);
  const closeViewer = useCallback(() => setActiveIdx(-1), []);

  usePageMeta({
    title: "Testimoni",
    description: "Lihat galeri pengalaman pelanggan Imzaqi Store per kategori paket produk sebelum memilih paketmu.",
  });

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    fetchTestimonials({ useCache: retry === 0 })
      .then((data) => {
        if (alive) setItems(Array.isArray(data) ? data.map(enrichTestimonial) : []);
      })
      .catch((e) => {
        warn(e);
        if (alive) setError("Periksa koneksi internet, lalu coba muat kembali.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [retry]);

  const insights = useMemo(() => buildStoreInsights({ testimonials: items }), [items]);

  const categoryTabs = useMemo(() => {
    const counts = { uncategorized: 0 };
    for (const item of items) {
      if (item.category_key === "uncategorized") {
        counts.uncategorized += 1;
      } else {
        counts[item.category_key] = (counts[item.category_key] || 0) + 1;
      }
    }
    const activeCategories = PRODUCT_CATEGORIES
      .filter((cat) => (counts[cat.key] || 0) > 0)
      .map((cat) => ({
        key: cat.key,
        label: cat.label,
        icon: cat.icon,
        count: counts[cat.key],
      }));

    if (activeCategories.length === 0) return [];

    const tabs = [{ key: "all", label: "Semua", icon: null, count: items.length }, ...activeCategories];
    if (counts.uncategorized > 0) {
      tabs.push({ key: "uncategorized", label: "Umum", icon: Tag, count: counts.uncategorized });
    }
    return tabs;
  }, [items]);

  const products = useMemo(() => {
    const pool = categoryFilter === "all"
      ? items
      : items.filter((item) => item.category_key === categoryFilter);
    return Array.from(
      new Set(pool.map((item) => String(item.product_name || "").trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, "id"));
  }, [items, categoryFilter]);

  useEffect(() => {
    if (
      categoryFilter !== "all" &&
      categoryTabs.length > 0 &&
      !categoryTabs.some((tab) => tab.key === categoryFilter)
    ) {
      setCategoryFilter("all");
    }
  }, [categoryTabs, categoryFilter]);

  useEffect(() => {
    if (productFilter !== "all" && !products.includes(productFilter)) {
      setProductFilter("all");
    }
  }, [products, productFilter]);

  const filtered = useMemo(() => items.filter((item) => {
    if (categoryFilter !== "all" && item.category_key !== categoryFilter) return false;
    if (productFilter !== "all" && String(item.product_name || "") !== productFilter) return false;
    const searchable = `${item.product_name || ""} ${item.category_label || ""} ${item.customer_name || ""} ${item.caption || ""}`.toLowerCase();
    return !q.trim() || searchable.includes(q.trim().toLowerCase());
  }), [items, q, categoryFilter, productFilter]);

  const hasSearchableMeta = useMemo(
    () => categoryTabs.length > 0 || products.length > 0 || insights.captionedTestimonialsCount > 0,
    [categoryTabs.length, products.length, insights.captionedTestimonialsCount]
  );

  const verifiedStories = useMemo(
    () => items.filter((item) => item.is_verified && item.caption?.trim()).slice(0, 3),
    [items]
  );

  const shown = filtered.slice(0, limit);
  const active = activeIdx >= 0 ? filtered[activeIdx] : null;
  const resetFilters = () => {
    setQ("");
    setCategoryFilter("all");
    setProductFilter("all");
  };

  useEffect(() => { setLimit(9); setActiveIdx(-1); }, [categoryFilter, productFilter, q, view]);
  useDialogA11y({ open: Boolean(active), containerRef: dialogRef, onClose: closeViewer });
  useEffect(() => {
    if (!active) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event) {
      if (filtered.length > 1 && event.key === "ArrowLeft") {
        event.preventDefault();
        setActiveIdx((i) => (i - 1 + filtered.length) % filtered.length);
      }
      if (filtered.length > 1 && event.key === "ArrowRight") {
        event.preventDefault();
        setActiveIdx((i) => (i + 1) % filtered.length);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [Boolean(active), filtered.length]);

  const activeHeadline = active
    ? (active.product_name || (active.category_label ? `Paket ${active.category_label}` : "") || active.display_caption || "Testimoni pelanggan")
    : "";
  const activeMetaParts = active
    ? [
        active.is_verified ? "Pembelian terverifikasi" : "",
        active.category_label && active.product_name ? active.category_label : "",
        active.rating ? `Rating ${active.rating}/5` : "",
        active.customer_name,
        formatTestimonialDate(active.purchased_at),
        active.display_caption && (active.product_name || active.category_label) ? active.display_caption : "",
      ].filter(Boolean)
    : [];

  return (
    <div className="reviews-page">
      <div className="reviews-wrap">
        <header className="reviews-hero">
          <div className="reviews-heroCopy">
            <div className="reviews-heroHeadRow">
              <h1>Testimoni Pelanggan</h1>
              <span className="reviews-result" role="status">
                {loading ? "Memuat galeri…" : error ? "Galeri belum tersedia" : `${filtered.length} testimoni`}
              </span>
            </div>
            <p>Bukti transaksi dan pengalaman asli pembeli di Imzaqi Store, dikelompokkan berdasarkan kategori paket produk.</p>
          </div>
        </header>

        {verifiedStories.length ? (
          <section className="reviews-verifiedStories" aria-labelledby="verified-stories-title">
            <div className="reviews-sectionHead"><h2 id="verified-stories-title">Cerita singkat pelanggan</h2></div>
            <div className="reviews-storyGrid">
              {verifiedStories.map((item) => (
                <article key={item.id} className="reviews-storyCard">
                  <BadgeCheck size={18} />
                  <p>“{item.display_caption || item.caption.trim()}”</p>
                  <div>
                    <strong>{item.customer_name || "Pelanggan"}</strong>
                    <span>{item.product_name || item.category_label || "Pesanan Imzaqi Store"}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="reviews-gallery" aria-label="Galeri pengalaman pelanggan">
          <div className="reviews-tools">
            {(loading || hasSearchableMeta) ? (
              <div className="reviews-search">
                <Search size={20} />
                <input
                  type="search"
                  aria-label="Cari testimoni"
                  placeholder="Cari nama produk atau kategori…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                {q && (
                  <button type="button" onClick={() => setQ("")} aria-label="Hapus pencarian">
                    <X size={18} />
                  </button>
                )}
              </div>
            ) : (
              <p className="reviews-galleryHint">
                <ZoomIn size={19} /> Ketuk screenshot untuk melihat bukti transaksi lebih jelas.
              </p>
            )}

            {categoryTabs.length > 0 && (
              <div className="reviews-filters" role="group" aria-label="Filter kategori paket produk">
                {categoryTabs.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <button
                      className="btn btn-ghost btn-sm"
                      key={cat.key}
                      type="button"
                      aria-pressed={categoryFilter === cat.key}
                      onClick={() => setCategoryFilter(cat.key)}
                    >
                      {Icon ? <Icon size={14} aria-hidden="true" /> : null}
                      <span>{cat.label}</span>
                      <span className="reviews-filterCount">{cat.count}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {products.length ? (
              <label className="reviews-productFilter">
                <span>Paket</span>
                <select value={productFilter} onChange={(event) => setProductFilter(event.target.value)}>
                  <option value="all">Semua paket</option>
                  {products.map((productName) => (
                    <option key={productName} value={productName}>{productName}</option>
                  ))}
                </select>
              </label>
            ) : null}

            <div className="reviews-view" role="group" aria-label="Tampilan galeri">
              <button
                className="btn btn-ghost btn-icon"
                type="button"
                aria-pressed={view === "grid"}
                aria-label="Grid"
                onClick={() => setView("grid")}
              >
                <Grid2x2 size={19} />
              </button>
              <button
                className="btn btn-ghost btn-icon"
                type="button"
                aria-pressed={view === "masonry"}
                aria-label="Masonry"
                onClick={() => setView("masonry")}
              >
                <LayoutGrid size={19} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="reviews-grid" aria-hidden="true">
              {Array.from({ length: 6 }, (_, i) => <div key={i} className="reviews-skeleton" />)}
            </div>
          ) : error ? (
            <div className="reviews-empty" role="alert">
              <ImageOff size={34} />
              <h3>Galeri belum bisa dimuat</h3>
              <p>{error}</p>
              <button className="reviews-button" type="button" onClick={() => setRetry((n) => n + 1)}>
                Coba lagi
              </button>
            </div>
          ) : !filtered.length ? (
            <div className="reviews-empty">
              <Images size={36} />
              <h3>{items.length ? "Testimoni belum ketemu" : "Testimoni pertama segera hadir"}</h3>
              <p>
                {items.length
                  ? "Coba pilih kategori lain atau reset filter untuk melihat semua testimoni."
                  : "Testimoni pelanggan akan ditampilkan di sini setelah ditambahkan."}
              </p>
              {items.length ? (
                <button className="reviews-button" type="button" onClick={resetFilters}>
                  Lihat semua testimoni
                </button>
              ) : (
                <Link className="reviews-button" to="/produk">
                  Jelajahi produk <ArrowUpRight size={17} />
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className={view === "grid" ? "reviews-grid" : "reviews-masonry"}>
                {shown.map((item, idx) => {
                  const CategoryIcon = item.category_meta?.icon || null;
                  const cardTitle =
                    item.product_name ||
                    (item.category_label ? `Paket ${item.category_label}` : "") ||
                    item.display_caption ||
                    "Testimoni pelanggan";
                  const subtitleParts = [
                    item.product_name || item.category_label ? item.display_caption : "",
                    item.customer_name,
                    formatTestimonialDate(item.purchased_at),
                  ].filter(Boolean);
                  const ariaLabel = `Buka testimoni ${idx + 1}${cardTitle !== "Testimoni pelanggan" ? `: ${cardTitle}` : ""}`;

                  return (
                    <button
                      className="reviews-card"
                      type="button"
                      key={item.id}
                      onClick={() => setActiveIdx(idx)}
                      aria-label={ariaLabel}
                    >
                      <span className="reviews-image">
                        <ReviewImage
                          key={item.image_url}
                          src={item.image_url}
                          alt={cardTitle !== "Testimoni pelanggan" ? `Testimoni ${cardTitle}` : `Screenshot testimoni ${idx + 1}`}
                        />
                        <span className="reviews-zoom" aria-hidden="true"><ZoomIn size={17} /></span>
                      </span>
                      <span className="reviews-cardCopy">
                        <span className="reviews-cardLabel">
                          <span className="reviews-cardBadge">
                            {item.is_verified ? <BadgeCheck size={14} aria-hidden="true" /> : CategoryIcon ? <CategoryIcon size={13} aria-hidden="true" /> : null}
                            <span>
                              {item.category_label
                                ? `${item.category_label.toUpperCase()}${item.rating ? ` · ${item.rating}/5` : ""}`
                                : item.is_verified
                                  ? `TERVERIFIKASI${item.rating ? ` · ${item.rating}/5` : ""}`
                                  : `TESTIMONI ${String(idx + 1).padStart(2, "0")}${item.rating ? ` · ${item.rating}/5` : ""}`}
                            </span>
                          </span>
                          <ArrowUpRight size={16} />
                        </span>
                        <strong>{cardTitle}</strong>
                        <small>{subtitleParts.join(" · ") || "Ketuk untuk melihat lengkap"}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
              {shown.length < filtered.length && (
                <div className="reviews-more">
                  <p>{shown.length} dari {filtered.length} testimoni</p>
                  <button
                    className="reviews-button reviews-button--secondary"
                    type="button"
                    onClick={() => setLimit((n) => n + 9)}
                  >
                    Lihat lebih banyak
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        <section className="reviews-support">
          <div className="reviews-supportIcon"><MessageSquareText size={28} /></div>
          <div>
            <span className="reviews-eyebrow">MASIH PUNYA PERTANYAAN?</span>
            <h2>Kenali dulu. Pilih dengan yakin.</h2>
            <p>Cek panduan pembayaran, aktivasi, dan bantuan di pusat FAQ.</p>
          </div>
          <Link className="reviews-button reviews-button--secondary" to="/faq">
            Buka FAQ <ArrowUpRight size={18} />
          </Link>
        </section>
      </div>

      {active && createPortal(
        <div className="reviews-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) closeViewer(); }}>
          <div ref={dialogRef} className="reviews-lightbox" role="dialog" aria-modal="true" aria-labelledby="reviews-viewer-title">
            <div className="reviews-viewerHead">
              <div>
                <span className="reviews-eyebrow">GALERI PELANGGAN</span>
                <h2 id="reviews-viewer-title">Testimoni {activeIdx + 1} dari {filtered.length}</h2>
              </div>
              <button className="reviews-iconButton" type="button" onClick={closeViewer} aria-label="Tutup testimoni">
                <X size={21} />
              </button>
            </div>
            <div className="reviews-viewerImage">
              <ReviewImage
                key={active.image_url}
                src={active.image_url}
                alt={activeHeadline !== "Testimoni pelanggan" ? `Testimoni ${activeHeadline}` : "Screenshot testimoni pelanggan"}
                eager
                isViewer
              />
            </div>
            <div className="reviews-viewerFoot">
              <div>
                <p>{activeHeadline}</p>
                {activeMetaParts.length > 0 ? (
                  <span className="reviews-verifiedMeta">
                    {active.is_verified ? <BadgeCheck size={14} /> : null}
                    {activeMetaParts.join(" · ")}
                  </span>
                ) : null}
              </div>
              {filtered.length > 1 && (
                <div className="reviews-viewerNav">
                  <button
                    className="reviews-iconButton"
                    type="button"
                    onClick={() => setActiveIdx((i) => (i - 1 + filtered.length) % filtered.length)}
                    aria-label="Testimoni sebelumnya"
                  >
                    <ChevronLeft size={22} />
                  </button>
                  <button
                    className="reviews-iconButton"
                    type="button"
                    onClick={() => setActiveIdx((i) => (i + 1) % filtered.length)}
                    aria-label="Testimoni berikutnya"
                  >
                    <ChevronRight size={22} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
