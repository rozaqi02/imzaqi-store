import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  ArrowUpRight, ChevronLeft, ChevronRight, Grid2x2, ImageOff,
  Images, LayoutGrid, MessageSquareText, Search, X, ZoomIn,
  BadgeCheck,
} from "lucide-react";
import { fetchTestimonials } from "../lib/api";
import { usePageMeta } from "../hooks/usePageMeta";
import { useDialogA11y } from "../hooks/useDialogA11y";
import { buildStoreInsights } from "../lib/storeInsights";
import { warn } from "../lib/log";
import BannerGraphic from "../components/BannerGraphic";

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
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </>
  );
}

export default function Testimonials() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [q, setQ] = useState("");
  const [captionMode, setCaptionMode] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [view, setView] = useState("grid");
  const [limit, setLimit] = useState(9);
  const [activeIdx, setActiveIdx] = useState(-1);
  const dialogRef = useRef(null);
  const closeViewer = useCallback(() => setActiveIdx(-1), []);

  usePageMeta({ title: "Testimoni", description: "Lihat galeri pengalaman pelanggan Imzaqi Store. Jelajahi screenshot dan cerita mereka sebelum memilih paketmu." });

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    fetchTestimonials({ useCache: retry === 0 })
      .then(data => { if (alive) setItems(Array.isArray(data) ? data : []); })
      .catch(e => { warn(e); if (alive) setError("Periksa koneksi internet, lalu coba muat kembali."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [retry]);

  const insights = useMemo(() => buildStoreInsights({ testimonials: items }), [items]);
  const filtered = useMemo(() => items.filter(item => {
    const caption = String(item.caption || "").trim();
    if (captionMode === "captioned" && !caption) return false;
    if (captionMode === "uncaptioned" && caption) return false;
    if (productFilter !== "all" && String(item.product_name || "") !== productFilter) return false;
    const searchable = `${caption} ${item.product_name || ""} ${item.customer_name || ""}`.toLowerCase();
    return !q.trim() || searchable.includes(q.trim().toLowerCase());
  }), [items, q, captionMode, productFilter]);
  const products = useMemo(() => Array.from(new Set(items.map(item => String(item.product_name || "").trim()).filter(Boolean))).sort(), [items]);
  const verifiedStories = useMemo(() => items.filter(item => item.is_verified && item.caption?.trim()).slice(0, 3), [items]);
  const shown = filtered.slice(0, limit);
  const active = activeIdx >= 0 ? filtered[activeIdx] : null;
  const resetFilters = () => { setQ(""); setCaptionMode("all"); setProductFilter("all"); };

  useEffect(() => { setLimit(9); setActiveIdx(-1); }, [captionMode, productFilter, q, view]);
  useDialogA11y({ open: Boolean(active), containerRef: dialogRef, onClose: closeViewer });
  useEffect(() => {
    if (!active) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event) {
      if (event.key === "ArrowLeft") { event.preventDefault(); setActiveIdx(i => (i - 1 + filtered.length) % filtered.length); }
      if (event.key === "ArrowRight") { event.preventDefault(); setActiveIdx(i => (i + 1) % filtered.length); }
    }
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKey); };
  }, [Boolean(active), filtered.length]);

  return (
    <div className="reviews-page">
      <div className="reviews-wrap">
        <header className="reviews-hero">
          <div className="reviews-heroCopy">
            <span className="reviews-eyebrow">
              <BannerGraphic name="sparkle_celebration" height={22} className="reviews-mascot" />
              <MessageSquareText size={16} /> CERITA PELANGGAN
            </span>
            <h1>Ulasan asli. <span>Pilih lebih yakin.</span></h1>
            <p>Lihat pengalaman pelanggan. Ketuk gambar untuk membaca percakapannya.</p>
            <Link className="hx-btn-primary" to="/produk">Temukan paketmu <ArrowUpRight size={18} /></Link>
          </div>
        </header>

        {verifiedStories.length ? (
          <section className="reviews-verifiedStories" aria-labelledby="verified-stories-title">
            <div className="reviews-sectionHead"><div><span className="reviews-eyebrow">PEMBELIAN TERVERIFIKASI</span><h2 id="verified-stories-title">Cerita singkat pelanggan.</h2></div></div>
            <div className="reviews-storyGrid">{verifiedStories.map(item => <article key={item.id} className="reviews-storyCard"><BadgeCheck size={20} /><p>“{item.caption.trim()}”</p><div><strong>{item.customer_name || "Pelanggan"}</strong><span>{item.product_name || "Pesanan Imzaqi Store"}</span></div></article>)}</div>
          </section>
        ) : null}

        <section className="reviews-gallery" aria-labelledby="reviews-gallery-title">
          <div className="reviews-sectionHead"><div><span className="reviews-eyebrow">LIHAT LEBIH DEKAT</span><h2 id="reviews-gallery-title">Galeri pengalaman pelanggan</h2></div><span className="reviews-result" role="status">{loading ? "Memuat galeri…" : error ? "Galeri belum tersedia" : `${filtered.length} testimoni`}</span></div>
          <div className="reviews-tools">
            {(loading || insights.captionedTestimonialsCount > 0) ? <div className="reviews-search"><Search size={20} /><input type="search" aria-label="Cari testimoni" placeholder="Cari cerita atau nama produk…" value={q} onChange={e => setQ(e.target.value)} />{q && <button type="button" onClick={() => setQ("")} aria-label="Hapus pencarian"><X size={18} /></button>}</div> : <p className="reviews-galleryHint"><ZoomIn size={19} /> Ketuk screenshot untuk membaca pengalaman lengkap.</p>}
            {insights.captionedTestimonialsCount > 0 && <div className="reviews-filters" role="group" aria-label="Filter testimoni">
              {[["all", "Semua"], ["captioned", "Dengan cerita"], ["uncaptioned", "Foto saja"]].map(([key, label]) => <button className="btn btn-ghost btn-sm" key={key} type="button" aria-pressed={captionMode === key} onClick={() => setCaptionMode(key)}>{label}</button>)}
            </div>}
            {products.length ? <label className="reviews-productFilter"><span>Produk</span><select value={productFilter} onChange={event => setProductFilter(event.target.value)}><option value="all">Semua produk</option>{products.map(productName => <option key={productName} value={productName}>{productName}</option>)}</select></label> : null}
            <div className="reviews-view" role="group" aria-label="Tampilan galeri"><button className="btn btn-ghost btn-icon" type="button" aria-pressed={view === "grid"} aria-label="Grid" onClick={() => setView("grid")}><Grid2x2 size={19} /></button><button className="btn btn-ghost btn-icon" type="button" aria-pressed={view === "masonry"} aria-label="Masonry" onClick={() => setView("masonry")}><LayoutGrid size={19} /></button></div>
          </div>

          {loading ? <div className="reviews-grid" aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <div key={i} className="reviews-skeleton" />)}</div>
            : error ? <div className="reviews-empty" role="alert"><ImageOff size={34} /><h3>Galeri belum bisa dimuat</h3><p>{error}</p><button className="reviews-button" type="button" onClick={() => setRetry(n => n + 1)}>Coba lagi</button></div>
            : !filtered.length ? <div className="reviews-empty"><Images size={36} /><h3>{items.length ? "Ceritanya belum ketemu" : "Cerita pertama segera hadir"}</h3><p>{items.length ? "Coba kata kunci lain atau lihat semua testimoni." : "Testimoni pelanggan akan ditampilkan di sini setelah ditambahkan."}</p>{items.length ? <button className="reviews-button" type="button" onClick={resetFilters}>Lihat semua testimoni</button> : <Link className="reviews-button" to="/produk">Jelajahi produk <ArrowUpRight size={17} /></Link>}</div>
            : <><div className={view === "grid" ? "reviews-grid" : "reviews-masonry"}>
              {shown.map((item, idx) => <button className="reviews-card" type="button" key={item.id} onClick={() => setActiveIdx(idx)} aria-label={`Buka testimoni ${idx + 1}${item.caption ? `: ${item.caption}` : ""}`}>
                <span className="reviews-image"><ReviewImage key={item.image_url} src={item.image_url} alt={item.caption || `Screenshot testimoni ${idx + 1}`} /><span className="reviews-zoom" aria-hidden="true"><ZoomIn size={17} /></span></span>
                <span className="reviews-cardCopy"><span className="reviews-cardLabel">{item.is_verified ? <><BadgeCheck size={14} /> TERVERIFIKASI</> : <>CERITA {String(idx + 1).padStart(2, "0")}</>}<ArrowUpRight size={16} /></span><strong>{item.caption?.trim() || "Testimoni pelanggan"}</strong><small>{[item.product_name, item.purchased_at ? new Intl.DateTimeFormat("id-ID", { month: "short", year: "numeric" }).format(new Date(item.purchased_at)) : null].filter(Boolean).join(" · ") || "Ketuk untuk melihat lengkap"}</small></span>
              </button>)}
            </div>{shown.length < filtered.length && <div className="reviews-more"><p>{shown.length} dari {filtered.length} testimoni</p><button className="reviews-button reviews-button--secondary" type="button" onClick={() => setLimit(n => n + 9)}>Lihat lebih banyak</button></div>}</>}
        </section>
        <section className="reviews-support"><div className="reviews-supportIcon"><MessageSquareText size={28} /></div><div><span className="reviews-eyebrow">MASIH PUNYA PERTANYAAN?</span><h2>Kenali dulu. Pilih dengan yakin.</h2><p>Cek panduan pembayaran, aktivasi, dan bantuan di pusat FAQ.</p></div><Link className="reviews-button reviews-button--secondary" to="/faq">Buka FAQ <ArrowUpRight size={18} /></Link></section>
      </div>
      {active && createPortal(
        <div className="reviews-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) closeViewer(); }}>
          <div ref={dialogRef} className="reviews-lightbox" role="dialog" aria-modal="true" aria-labelledby="reviews-viewer-title">
            <div className="reviews-viewerHead"><div><span className="reviews-eyebrow">GALERI PELANGGAN</span><h2 id="reviews-viewer-title">Testimoni {activeIdx + 1} dari {filtered.length}</h2></div><button className="reviews-iconButton" type="button" onClick={closeViewer} aria-label="Tutup testimoni"><X size={21} /></button></div>
            <div className="reviews-viewerImage"><ReviewImage key={active.image_url} src={active.image_url} alt={active.caption || "Screenshot testimoni pelanggan"} eager isViewer /></div>
            <div className="reviews-viewerFoot"><div><p>{active.caption?.trim() || "Testimoni pelanggan"}</p>{active.is_verified ? <span className="reviews-verifiedMeta"><BadgeCheck size={14} /> Pembelian terverifikasi{active.product_name ? ` · ${active.product_name}` : ""}</span> : null}</div>{filtered.length > 1 && <div className="reviews-viewerNav"><button className="reviews-iconButton" type="button" onClick={() => setActiveIdx(i => (i - 1 + filtered.length) % filtered.length)} aria-label="Testimoni sebelumnya"><ChevronLeft size={22} /></button><button className="reviews-iconButton" type="button" onClick={() => setActiveIdx(i => (i + 1) % filtered.length)} aria-label="Testimoni berikutnya"><ChevronRight size={22} /></button></div>}</div>
          </div>
        </div>, document.body)}
    </div>
  );
}
