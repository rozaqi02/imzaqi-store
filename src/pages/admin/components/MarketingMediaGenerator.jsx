import React, { useEffect, useRef, useState, useMemo } from "react";
import { Download, Copy, Sparkles, FileText, Shuffle, ChevronLeft, ChevronRight, LoaderCircle, RotateCcw } from "lucide-react";
import QRCode from "qrcode";
import { formatIDR, getVariantEffectivePrice } from "../../../lib/format";
import { fetchActiveFlashSales } from "../../../lib/api";
import { resolveProductCategory, resolveCatalogLine, STORE_WHATSAPP } from "../../../lib/productCategories";
import { useToast } from "../../../context/ToastContext";
import { MEDIA_FORMATS, MEDIA_STYLES, activeVariants, chooseVariant, liveDiscounts, posterOffer, paginateCatalog, normalizeMediaPhone } from "./marketingMediaModel";
import { drawProductPoster, drawCatalogPoster } from "./marketingMediaRenderer";
import { loadMediaImage, canvasPng, downloadMedia, mediaZip } from "./marketingMediaExport";
import "./MarketingMediaGenerator.css";

async function prepareCanvas(options, pageOverride) {
  await document.fonts?.ready;
  if (document.fonts?.load) await Promise.all([document.fonts.load('700 32px "Outfit"'), document.fonts.load('600 24px "Outfit"')]);
  const canvas = document.createElement("canvas");
  const catalog = options.mode === "catalog", page = pageOverride ?? options.page;
  const products = catalog ? options.pages[page] || [] : [options.product];
  const url = catalog ? "https://imzaqi.store/produk" : options.offer.url;
  const [images, qr] = await Promise.all([
    Promise.all(products.map(p => loadMediaImage(p.icon_url))),
    QRCode.toDataURL(url, { margin: 4, width: 320, errorCorrectionLevel: "M" }).then(loadMediaImage),
  ]);
  if (catalog) drawCatalogPoster(canvas, { products, discounts: options.discounts, theme: options.catalogTheme, page: page + 1, pageCount: options.pages.length, total: options.total, images, qr, phone: options.phone });
  else drawProductPoster(canvas, { offer: options.offer, styleId: options.styleId, format: options.format, variation: options.variation, headline: options.headline, badge: options.badge, image: images[0], qr, phone: options.phone });
  return { canvas, missingImages: images.some(image => !image) };
}

export default function MarketingMediaGenerator({ products = [], settings = {} }) {
  const toast = useToast();
  const [mode, setMode] = useState("single");
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [styleId, setStyleId] = useState("best_seller");
  const [format, setFormat] = useState("square");
  const [variation, setVariation] = useState(0);
  const [headline, setHeadline] = useState("");
  const [badge, setBadge] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("");
  const [catalogCategory, setCatalogCategory] = useState("all");
  const [catalogTheme, setCatalogTheme] = useState("emerald");
  const [catalogPage, setCatalogPage] = useState(0);
  const [sales, setSales] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [saleError, setSaleError] = useState(false);
  const [salesPending, setSalesPending] = useState(true);
  const [renderState, setRenderState] = useState({ busy: true, error: "", missingImages: false });
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [retry, setRetry] = useState(0);
  const canvasRef = useRef(null), readyRef = useRef(null), requestRef = useRef(0);
  const mountedRef = useRef(true), copyTimer = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    let alive = true;
    fetchActiveFlashSales({ useCache: false })
      .then(data => { if (alive) setSales(data); })
      .catch(() => { if (alive) setSaleError(true); })
      .finally(() => { if (alive) setSalesPending(false); });
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => { alive = false; mountedRef.current = false; clearInterval(timer); clearTimeout(copyTimer.current); };
  }, []);
  const discountKey = JSON.stringify([...liveDiscounts(sales, now)]);
  const discounts = useMemo(() => new Map(JSON.parse(discountKey)), [discountKey]);
  const activeProducts = useMemo(() => products.filter(p => p.is_active !== false), [products]);
  const product = activeProducts.find(p => String(p.id) === productId) || activeProducts[0];
  const variants = useMemo(() => activeVariants(product), [product]);
  useEffect(() => {
    if (variantId && !variants.some(v => String(v.id) === variantId)) {
      setVariantId(""); setPrice(""); setDuration("");
    }
  }, [variants, variantId]);
  const variant = useMemo(() => chooseVariant(product, variantId, discounts), [product, variantId, discounts]);
  const offerResult = useMemo(() => {
    try { return { offer: posterOffer(product, variant, discounts, { price, duration }), error: "" }; }
    catch (error) { return { offer: null, error: error.message }; }
  }, [product, variant, discounts, price, duration]);
  const categories = useMemo(() => [...new Map(activeProducts.map(p => { const c = resolveProductCategory(p); return [c.key, c]; })).values()], [activeProducts]);
  useEffect(() => {
    if (catalogCategory !== "all" && !categories.some(c => c.key === catalogCategory)) {
      setCatalogCategory("all"); setCatalogPage(0);
    }
  }, [categories, catalogCategory]);
  const filtered = useMemo(() => activeProducts.filter(p => catalogCategory === "all" || resolveProductCategory(p).key === catalogCategory), [activeProducts, catalogCategory]);
  const pages = useMemo(() => paginateCatalog(filtered), [filtered]);
  const page = Math.min(catalogPage, Math.max(0, pages.length - 1));
  const line = resolveCatalogLine(product);
  const phone = mode === "single" ? normalizeMediaPhone(settings?.whatsapp?.[line] || (line === "app_premium" && settings?.whatsapp?.number) || STORE_WHATSAPP[line]) : "";
  const options = useMemo(() => ({ mode, product, offer: offerResult.offer, styleId, format, variation, headline, badge, pages, page, total: filtered.length, catalogTheme, phone, discounts, retry }),
    [mode, product, offerResult.offer, styleId, format, variation, headline, badge, pages, page, filtered.length, catalogTheme, phone, discounts, retry]);
  const empty = mode === "single" ? !product : !filtered.length;
  const invalid = mode === "single" ? offerResult.error : "";

  useEffect(() => {
    const request = ++requestRef.current;
    readyRef.current = null; setCopied(false);
    setRenderState({ busy: !empty && !invalid, error: invalid, missingImages: false });
    if (empty || invalid || salesPending) return;
    const timer = setTimeout(() => {
      prepareCanvas(options).then(({ canvas, missingImages }) => {
        if (requestRef.current !== request || !canvasRef.current) return;
        const target = canvasRef.current;
        target.width = canvas.width; target.height = canvas.height;
        target.getContext("2d").drawImage(canvas, 0, 0);
        readyRef.current = { options, canvas };
        setRenderState({ busy: false, error: "", missingImages });
      }).catch(error => {
        if (requestRef.current === request) setRenderState({ busy: false, error: error.message || "Preview gagal dibuat. Coba lagi.", missingImages: false });
      });
    }, 160);
    return () => { clearTimeout(timer); requestRef.current++; };
  }, [options, empty, invalid, salesPending]);

  const ready = !empty && !invalid && !salesPending && !renderState.busy && !renderState.error && readyRef.current?.options === options;
  const filename = mode === "single" ? `imzaqi-${product?.slug || "produk"}-${styleId}-${format}.png` : `imzaqi-katalog-${catalogCategory}-${page + 1}.png`;
  const exportImage = async action => {
    const rendered = readyRef.current;
    if (!ready || exporting || rendered?.options !== options) return;
    setExporting(true);
    try {
      const blob = canvasPng(rendered.canvas);
      // A clipboard constructor may reject before it consumes the Blob promise.
      blob.catch(() => {});
      if (action === "copy" && navigator.clipboard?.write && window.ClipboardItem) {
        // Write starts in the click's activation window, including Safari.
        await navigator.clipboard.write([new window.ClipboardItem({ "image/png": blob })]);
        if (mountedRef.current) setCopied(true);
        clearTimeout(copyTimer.current);
        copyTimer.current = setTimeout(() => { if (mountedRef.current) setCopied(false); }, 2200);
        toast.success("Gambar tersalin. Paste ke WhatsApp atau Telegram.");
      } else {
        downloadMedia(await blob, filename);
        toast.success(action === "copy" ? "Copy belum didukung browser ini. PNG diunduh." : "PNG berhasil diunduh.");
      }
    } catch (error) { toast.error(action === "copy" ? "Gambar belum bisa disalin. Gunakan Download PNG." : error.message); }
    finally { if (mountedRef.current) setExporting(false); }
  };
  const exportCatalog = async () => {
    if (!ready || exporting) return;
    setExporting(true);
    const snapshot = options;
    try {
      const files = [];
      for (let i = 0; i < snapshot.pages.length; i++) {
        const { canvas } = await prepareCanvas(snapshot, i);
        files.push({ name: `imzaqi-katalog-${i + 1}.png`, blob: await canvasPng(canvas) });
      }
      downloadMedia(await mediaZip(files), `imzaqi-katalog-${catalogCategory}.zip`);
      toast.success(`${files.length} halaman katalog diunduh dalam satu ZIP.`);
    } catch (error) { toast.error(error.message); }
    finally { if (mountedRef.current) setExporting(false); }
  };
  const resetCopy = () => { setHeadline(""); setBadge(""); setPrice(""); setDuration(""); };

  return <div className="mmg-container">
    <div className="mmg-modeSwitch" aria-label="Jenis media">
      {[{ id: "single", title: "Poster produk", text: "Satu produk, satu pesan yang kuat", icon: Sparkles }, { id: "catalog", title: "Katalog harga", text: "Daftar produk dalam beberapa halaman", icon: FileText }].map(item => <button key={item.id} type="button" className={`mmg-modeCard ${mode === item.id ? "is-active" : ""}`} aria-pressed={mode === item.id} onClick={() => setMode(item.id)}><item.icon size={22}/><span><strong>{item.title}</strong><small>{item.text}</small></span></button>)}
    </div>
    <div className="mmg-layout">
      <div className="mmg-controlsCard">
        {mode === "single" ? <>
          <label className="mmg-field">Produk<select value={product?.id || ""} onChange={e => { setProductId(e.target.value); setVariantId(""); resetCopy(); }} disabled={!activeProducts.length}>{!activeProducts.length && <option value="">Belum ada produk aktif</option>}{activeProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label className="mmg-field">Paket / varian<select value={variantId} onChange={e => { setVariantId(e.target.value); setPrice(""); setDuration(""); }} disabled={!variants.length}><option value="">Otomatis · harga terendah yang tersedia</option>{variants.map(v => <option key={v.id} value={v.id}>{v.name} · {formatIDR(getVariantEffectivePrice(v, discounts))}{discounts.has(v.id) ? " · Promo" : ""}{v.stock != null && Number(v.stock) <= 0 ? " · Habis" : ""}</option>)}</select></label>
          {variant && <p className="mmg-note">Paket terpilih: <strong>{variant.name}</strong>{offerResult.offer?.outOfStock && " · stok habis"}</p>}
          <fieldset className="mmg-fieldset"><legend>Arah desain</legend><div className="mmg-presetGrid">{MEDIA_STYLES.map(s => <button type="button" key={s.id} className={`mmg-style ${s.id === styleId ? "is-selected" : ""}`} aria-pressed={s.id === styleId} onClick={() => setStyleId(s.id)}><span className="mmg-swatches" aria-hidden="true"><i style={{ background: s.bg }}/><i style={{ background: s.ink }}/><i style={{ background: s.accent }}/></span><strong>{s.name}</strong><small>{s.detail}</small></button>)}</div></fieldset>
          <fieldset className="mmg-fieldset"><legend>Ukuran gambar</legend><div className="mmg-formats">{Object.entries(MEDIA_FORMATS).map(([id, f]) => <button type="button" key={id} aria-pressed={format === id} className={format === id ? "is-selected" : ""} onClick={() => setFormat(id)}><strong>{f.ratio}</strong><small>{f.label}</small></button>)}</div></fieldset>
          <button type="button" className="mmg-secondary" onClick={() => setVariation(v => v + 1)}><Shuffle size={16}/>Variasikan komposisi</button>
          <details className="mmg-customize"><summary>Ubah teks & harga</summary><div>
            <label className="mmg-field">Headline<input maxLength={70} value={headline} onChange={e => setHeadline(e.target.value)} placeholder="Kosongkan untuk headline bawaan"/></label>
            <label className="mmg-field">Label kecil<input maxLength={45} value={badge} onChange={e => setBadge(e.target.value)} placeholder="Contoh: PILIHAN MINGGU INI"/></label>
            <label className="mmg-field">Harga manual (Rp)<input type="number" min="1" step="1" value={price} onChange={e => setPrice(e.target.value)} placeholder={String(offerResult.offer?.price || "Harga dari paket")}/></label>
            <label className="mmg-field">Durasi / keterangan<input maxLength={70} value={duration} onChange={e => setDuration(e.target.value)} placeholder={variant?.duration_label || "Mengikuti paket"}/></label>
            <button type="button" className="mmg-secondary" onClick={resetCopy}><RotateCcw size={15}/>Kembalikan teks & harga</button>
          </div></details>
        </> : <>
          <label className="mmg-field">Kategori<select value={catalogCategory} onChange={e => { setCatalogCategory(e.target.value); setCatalogPage(0); }}><option value="all">Semua kategori</option>{categories.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}</select></label>
          <fieldset className="mmg-fieldset"><legend>Tema katalog</legend><div className="mmg-formats">{[{ id: "emerald", name: "Kertas & hijau" }, { id: "dark", name: "Onyx & lime" }].map(s => <button type="button" key={s.id} className={catalogTheme === s.id ? "is-selected" : ""} aria-pressed={catalogTheme === s.id} onClick={() => setCatalogTheme(s.id)}>{s.name}</button>)}</div></fieldset>
          <p className="mmg-note">{filtered.length} produk aktif · {pages.length} halaman. Maksimal 10 produk per halaman agar nama dan harga nyaman dibaca.</p>
        </>}
        <p className="mmg-note">Harga dan garansi mengikuti paket. Harga coret hanya muncul bila ada potongan dari harga aslinya.</p>
        {saleError && <p className="mmg-warning">Flash sale belum berhasil dimuat. Harga mengikuti harga dasar paket.</p>}
      </div>
      <div className="mmg-stageWrap">
        <div className="mmg-previewHeading"><span>Preview hasil</span><small>{mode === "single" ? `${MEDIA_FORMATS[format].width} × ${MEDIA_FORMATS[format].height} px` : "1200 × 1600 px / halaman"}</small></div>
        <div className="mmg-canvasBox" aria-busy={renderState.busy}>
          <canvas ref={canvasRef} className={`mmg-canvasPreview ${!ready ? "is-pending" : ""}`} role="img" aria-label={mode === "single" ? `Poster ${product?.name || "produk"}` : `Katalog halaman ${page + 1}`}/>
          {!ready && <div className="mmg-previewStatus" role="status">{empty ? "Belum ada produk untuk ditampilkan." : renderState.error || <><LoaderCircle className="mmg-spinner" size={22}/>Menyiapkan desain…</>}{renderState.error && !invalid && <button type="button" onClick={() => setRetry(v => v + 1)}>Coba lagi</button>}</div>}
        </div>
        {renderState.missingImages && <p className="mmg-warning">Sebagian logo tidak berhasil dimuat. Poster memakai inisial produk sebagai pengganti.</p>}
        {mode === "catalog" && pages.length > 1 && <div className="mmg-pagination"><button type="button" aria-label="Halaman sebelumnya" disabled={page === 0 || exporting} onClick={() => setCatalogPage(page - 1)}><ChevronLeft size={18}/></button><span>Halaman {page + 1} dari {pages.length}</span><button type="button" aria-label="Halaman berikutnya" disabled={page === pages.length - 1 || exporting} onClick={() => setCatalogPage(page + 1)}><ChevronRight size={18}/></button></div>}
        <div className="mmg-actionsBar"><button type="button" className="mmg-btnDownload" disabled={!ready || exporting} onClick={() => exportImage("download")}><Download size={18}/>{exporting ? "Menyiapkan…" : "Download PNG"}</button><button type="button" className="mmg-btnCopy" disabled={!ready || exporting} onClick={() => exportImage("copy")}><Copy size={18}/>{copied ? "Gambar tersalin" : "Salin gambar"}</button>{mode === "catalog" && pages.length > 1 && <button type="button" className="mmg-secondary" disabled={!ready || exporting} onClick={exportCatalog}><Download size={17}/>Semua halaman (ZIP)</button>}</div>
        <p className="mmg-note">PNG resolusi penuh, siap untuk WhatsApp, Instagram, dan Telegram.</p>
      </div>
    </div>
  </div>;
}
