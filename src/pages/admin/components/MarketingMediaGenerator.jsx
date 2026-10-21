import React, { useEffect, useRef, useState, useMemo } from "react";
import { Download, Copy, Sparkles, FileText, Shuffle, ChevronLeft, ChevronRight, LoaderCircle, RotateCcw, Layers } from "lucide-react";
import QRCode from "qrcode";
import { formatIDR, getVariantEffectivePrice, isKnownOutOfStock } from "../../../lib/format";
import { fetchActiveFlashSales } from "../../../lib/api";
import { resolveProductCategory, resolveCatalogLine, STORE_WHATSAPP } from "../../../lib/productCategories";
import { useToast } from "../../../context/ToastContext";
import { MEDIA_FORMATS, MEDIA_STYLES, activeVariants, chooseVariant, liveDiscounts, posterOffer, paginateCatalog, buildCatalogEntries, normalizeMediaPhone } from "./marketingMediaModel";
import { drawProductPoster, drawCatalogPoster } from "./marketingMediaRenderer";
import { loadMediaImage, canvasPng, downloadMedia, mediaZip } from "./marketingMediaExport";
import AdminPicker from "./AdminPicker";
import "./MarketingMediaGenerator.css";

async function prepareCanvas(options, pageOverride) {
  await document.fonts?.ready;
  if (document.fonts?.load) await Promise.all([document.fonts.load('700 32px "Poppins"'), document.fonts.load('600 24px "Poppins"')]);
  const canvas = document.createElement("canvas");
  const catalog = options.mode === "catalog" || options.mode === "variants", page = pageOverride ?? options.page;
  const items = catalog ? options.pages[page] || [] : [options.product];
  const withoutLogo = items.find(item => !String((item.product?.icon_url || item.icon_url) || "").trim());
  if (withoutLogo) throw new Error(`Logo ${withoutLogo.product?.name || withoutLogo.name} belum tersedia di database. Tambahkan logo di menu Produk.`);
  const url = catalog ? "https://imzaqi.store/produk" : options.offer.url;
  const [images, qr] = await Promise.all([
    Promise.all(items.map(item => loadMediaImage(String(item.product?.icon_url || item.icon_url).trim()))),
    QRCode.toDataURL(url, { margin: 4, width: 320, errorCorrectionLevel: "M" }).then(loadMediaImage),
  ]);
  const missingLogo = images.findIndex(image => !image);
  if (missingLogo !== -1) throw new Error(`Logo ${(items[missingLogo].product?.name || items[missingLogo].name)} dari database gagal dimuat. Periksa URL logo di menu Produk, lalu coba lagi.`);
  if (catalog) drawCatalogPoster(canvas, { products: items, discounts: options.discounts, theme: options.catalogTheme, page: page + 1, pageCount: options.pages.length, total: options.total, images, qr, phone: options.phone, catalogScope: options.catalogScope });
  else drawProductPoster(canvas, { offer: options.offer, styleId: options.styleId, format: options.format, variation: options.variation, headline: options.headline, badge: options.badge, image: images[0], qr, phone: options.phone });
  return { canvas };
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
  const [catalogProductFilter, setCatalogProductFilter] = useState("all");
  const [catalogTheme, setCatalogTheme] = useState("emerald");
  const [catalogPage, setCatalogPage] = useState(0);
  const [onlyActive, setOnlyActive] = useState(true);
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [sales, setSales] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [saleError, setSaleError] = useState(false);
  const [salesPending, setSalesPending] = useState(true);
  const [renderState, setRenderState] = useState({ busy: true, error: "" });
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
  const availableProducts = useMemo(() => {
    return products.filter(p => {
      if (onlyActive && p.is_active === false) return false;
      if (onlyInStock) {
        const vars = Array.isArray(p.product_variants) ? p.product_variants : [];
        const validVars = onlyActive ? vars.filter(v => v.is_active !== false) : vars;
        if (!validVars.some(v => !isKnownOutOfStock(v))) return false;
      }
      return true;
    });
  }, [products, onlyActive, onlyInStock]);
  const product = availableProducts.find(p => String(p.id) === productId) || availableProducts[0];
  const variants = useMemo(() => {
    let list = Array.isArray(product?.product_variants) ? product.product_variants : [];
    if (onlyActive) list = list.filter(v => v.is_active !== false);
    if (onlyInStock) list = list.filter(v => !isKnownOutOfStock(v));
    return list;
  }, [product, onlyActive, onlyInStock]);
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
  const categories = useMemo(() => [...new Map(availableProducts.map(p => { const c = resolveProductCategory(p); return [c.key, c]; })).values()], [availableProducts]);
  useEffect(() => {
    if (catalogCategory !== "all" && !categories.some(c => c.key === catalogCategory)) {
      setCatalogCategory("all"); setCatalogPage(0); setCatalogProductFilter("all");
    }
  }, [categories, catalogCategory]);
  const filtered = useMemo(() => availableProducts.filter(p => catalogCategory === "all" || resolveProductCategory(p).key === catalogCategory), [availableProducts, catalogCategory]);
  const isCatalog = mode === "catalog" || mode === "variants";
  const catalogScope = mode === "variants" ? "variants" : "products";
  const catalogEntries = useMemo(() => {
    return buildCatalogEntries(filtered, catalogScope, discounts, mode === "variants" ? catalogProductFilter : "all", { onlyActive, onlyInStock });
  }, [filtered, catalogScope, discounts, mode, catalogProductFilter, onlyActive, onlyInStock]);
  const pages = useMemo(() => paginateCatalog(isCatalog ? catalogEntries : filtered), [isCatalog, catalogEntries, filtered]);
  const page = Math.min(catalogPage, Math.max(0, pages.length - 1));
  const total = isCatalog ? catalogEntries.length : filtered.length;
  const line = resolveCatalogLine(product);
  const phone = mode === "single" ? normalizeMediaPhone(settings?.whatsapp?.[line] || (line === "app_premium" && settings?.whatsapp?.number) || STORE_WHATSAPP[line]) : "";
  const options = useMemo(() => ({ mode, product, offer: offerResult.offer, styleId, format, variation, headline, badge, pages, page, total, catalogTheme, phone, discounts, retry, catalogScope }),
    [mode, product, offerResult.offer, styleId, format, variation, headline, badge, pages, page, total, catalogTheme, phone, discounts, retry, catalogScope]);
  const empty = mode === "single" ? !product : !catalogEntries.length;
  const invalid = mode === "single" ? offerResult.error : "";

  useEffect(() => {
    const request = ++requestRef.current;
    readyRef.current = null; setCopied(false);
    setRenderState({ busy: !empty && !invalid, error: invalid });
    if (empty || invalid || salesPending) return;
    const timer = setTimeout(() => {
      prepareCanvas(options).then(({ canvas }) => {
        if (requestRef.current !== request || !canvasRef.current) return;
        const target = canvasRef.current;
        target.width = canvas.width; target.height = canvas.height;
        target.getContext("2d").drawImage(canvas, 0, 0);
        readyRef.current = { options, canvas };
        setRenderState({ busy: false, error: "" });
      }).catch(error => {
        if (requestRef.current === request) setRenderState({ busy: false, error: error.message || "Preview gagal dibuat. Coba lagi." });
      });
    }, 160);
    return () => { clearTimeout(timer); requestRef.current++; };
  }, [options, empty, invalid, salesPending]);

  const ready = !empty && !invalid && !salesPending && !renderState.busy && !renderState.error && readyRef.current?.options === options;
  const filename = mode === "single" ? `imzaqi-${product?.slug || "produk"}-${styleId}-${format}.png` : `imzaqi-katalog-${mode === "variants" ? "varian-" : ""}${catalogCategory}-${page + 1}.png`;
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
    const isVariants = snapshot.mode === "variants";
    try {
      const files = [];
      for (let i = 0; i < snapshot.pages.length; i++) {
        const { canvas } = await prepareCanvas(snapshot, i);
        files.push({ name: `imzaqi-katalog-${isVariants ? "varian-" : ""}${i + 1}.png`, blob: await canvasPng(canvas) });
      }
      downloadMedia(await mediaZip(files), `imzaqi-katalog-${isVariants ? "varian-" : ""}${catalogCategory}.zip`);
      toast.success(`${files.length} halaman katalog diunduh dalam satu ZIP.`);
    } catch (error) { toast.error(error.message); }
    finally { if (mountedRef.current) setExporting(false); }
  };
  const resetCopy = () => { setHeadline(""); setBadge(""); setPrice(""); setDuration(""); };

  return <div className="mmg-container">
    <div className="mmg-modeSwitch" aria-label="Jenis media">
      {[
        { id: "single", title: "Poster produk", text: "Satu produk, satu pesan yang kuat", icon: Sparkles },
        { id: "catalog", title: "Katalog harga", text: "Daftar per produk dengan harga mulai", icon: FileText },
        { id: "variants", title: "Katalog semua varian", text: "Daftar seluruh paket & varian lengkap", icon: Layers }
      ].map(item => <button key={item.id} type="button" className={`mmg-modeCard ${mode === item.id ? "is-active" : ""}`} aria-pressed={mode === item.id} onClick={() => { setMode(item.id); setCatalogPage(0); }}><item.icon size={22}/><span><strong>{item.title}</strong><small>{item.text}</small></span></button>)}
    </div>
    <div className="mmg-layout">
      <div className="mmg-controlsCard">
        <fieldset className="mmg-fieldset">
          <legend>Filter ketersediaan</legend>
          <div className="mmg-filterRow">
            <label className="mmg-checkLabel">
              <input
                type="checkbox"
                checked={onlyActive}
                onChange={e => { setOnlyActive(e.target.checked); setCatalogPage(0); }}
              />
              <span>Hanya produk aktif</span>
            </label>
            <label className="mmg-checkLabel">
              <input
                type="checkbox"
                checked={onlyInStock}
                onChange={e => { setOnlyInStock(e.target.checked); setCatalogPage(0); }}
              />
              <span>Hanya ready stok</span>
            </label>
          </div>
        </fieldset>
        {mode === "single" && <>
          <AdminPicker label="Produk" value={product?.id || ""} onChange={id => { setProductId(String(id)); setVariantId(""); resetCopy(); }} disabled={!availableProducts.length} placeholder="Belum ada produk aktif" options={availableProducts.map(p => ({ value: p.id, label: p.name, icon: p.icon_url, description: `${resolveProductCategory(p).label} · ${activeVariants(p).length} paket` }))}/>
          <AdminPicker label="Paket / varian" value={variantId} onChange={id => { setVariantId(String(id)); setPrice(""); setDuration(""); }} disabled={!variants.length} options={[{ value: "", label: "Otomatis", description: "Harga terendah yang tersedia", meta: variant ? formatIDR(getVariantEffectivePrice(variant, discounts)) : "", icon: product?.icon_url }, ...variants.map(v => ({ value: v.id, label: v.name, icon: product?.icon_url, description: v.duration_label || "", meta: formatIDR(getVariantEffectivePrice(v, discounts)), searchText: String(getVariantEffectivePrice(v, discounts)), status: [isKnownOutOfStock(v) ? "Stok habis" : v.stock == null || v.stock === "" ? "Stok belum diisi" : `Stok ${v.stock}`, discounts.has(v.id) ? "Promo" : ""].filter(Boolean).join(" · "), statusTone: isKnownOutOfStock(v) ? "muted" : "" }))]}/>
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
        </>}
        {mode === "catalog" && <>
          <AdminPicker label="Kategori" value={catalogCategory} onChange={key => { setCatalogCategory(key); setCatalogPage(0); }} options={[{ value: "all", label: "Semua kategori", meta: `${availableProducts.length} produk` }, ...categories.map(c => ({ value: c.key, label: c.label, meta: `${availableProducts.filter(p => resolveProductCategory(p).key === c.key).length} produk` }))]}/>
          <fieldset className="mmg-fieldset"><legend>Tema katalog</legend><div className="mmg-formats">{[{ id: "emerald", name: "Kertas & hijau" }, { id: "dark", name: "Onyx & lime" }].map(s => <button type="button" key={s.id} className={catalogTheme === s.id ? "is-selected" : ""} aria-pressed={catalogTheme === s.id} onClick={() => setCatalogTheme(s.id)}>{s.name}</button>)}</div></fieldset>
          <p className="mmg-note">{filtered.length} produk {onlyInStock ? "ready stok" : "aktif"} · {pages.length} halaman. Maksimal 10 produk per halaman agar nama dan harga nyaman dibaca.</p>
        </>}
        {mode === "variants" && <>
          <AdminPicker label="Kategori" value={catalogCategory} onChange={key => { setCatalogCategory(key); setCatalogPage(0); }} options={[{ value: "all", label: "Semua kategori", meta: `${availableProducts.length} produk` }, ...categories.map(c => ({ value: c.key, label: c.label, meta: `${availableProducts.filter(p => resolveProductCategory(p).key === c.key).length} produk` }))]}/>
          <AdminPicker
            label="Filter produk (opsional)"
            value={catalogProductFilter}
            onChange={id => { setCatalogProductFilter(id); setCatalogPage(0); }}
            options={[
              { value: "all", label: "Semua produk", meta: `${filtered.length} produk` },
              ...filtered.map(p => ({
                value: String(p.id),
                label: p.name,
                icon: p.icon_url,
                meta: `${activeVariants(p).length} paket`
              }))
            ]}
          />
          <fieldset className="mmg-fieldset"><legend>Tema katalog</legend><div className="mmg-formats">{[{ id: "emerald", name: "Kertas & hijau" }, { id: "dark", name: "Onyx & lime" }].map(s => <button type="button" key={s.id} className={catalogTheme === s.id ? "is-selected" : ""} aria-pressed={catalogTheme === s.id} onClick={() => setCatalogTheme(s.id)}>{s.name}</button>)}</div></fieldset>
          <p className="mmg-note">{catalogEntries.length} paket / varian {onlyInStock ? "ready stok" : "aktif"} · {pages.length} halaman. Maksimal 10 paket per halaman agar nama dan harga nyaman dibaca.</p>
        </>}
        <p className="mmg-note">Harga mengikuti paket. Harga coret hanya muncul bila ada potongan dari harga aslinya.</p>
        {saleError && <p className="mmg-warning">Flash sale belum berhasil dimuat. Harga mengikuti harga dasar paket.</p>}
      </div>
      <div className="mmg-stageWrap">
        <div className="mmg-previewHeading"><span>Preview hasil</span><small>{mode === "single" ? `${MEDIA_FORMATS[format].width} × ${MEDIA_FORMATS[format].height} px` : "1200 × 1600 px / halaman"}</small></div>
        <div className="mmg-canvasBox" aria-busy={renderState.busy}>
          <canvas ref={canvasRef} className={`mmg-canvasPreview ${!ready ? "is-pending" : ""}`} role="img" aria-label={mode === "single" ? `Poster ${product?.name || "produk"}` : mode === "variants" ? `Katalog varian halaman ${page + 1}` : `Katalog halaman ${page + 1}`}/>
          {!ready && <div className="mmg-previewStatus" role="status">{empty ? "Belum ada produk untuk ditampilkan." : renderState.error || <><LoaderCircle className="mmg-spinner" size={22}/>Menyiapkan desain…</>}{renderState.error && !invalid && <button type="button" onClick={() => setRetry(v => v + 1)}>Coba lagi</button>}</div>}
        </div>
        {isCatalog && pages.length > 1 && <div className="mmg-pagination"><button type="button" aria-label="Halaman sebelumnya" disabled={page === 0 || exporting} onClick={() => setCatalogPage(page - 1)}><ChevronLeft size={18}/></button><span>Halaman {page + 1} dari {pages.length}</span><button type="button" aria-label="Halaman berikutnya" disabled={page === pages.length - 1 || exporting} onClick={() => setCatalogPage(page + 1)}><ChevronRight size={18}/></button></div>}
        <div className="mmg-actionsBar"><button type="button" className="mmg-btnDownload" disabled={!ready || exporting} onClick={() => exportImage("download")}><Download size={18}/>{exporting ? "Menyiapkan…" : "Download PNG"}</button><button type="button" className="mmg-btnCopy" disabled={!ready || exporting} onClick={() => exportImage("copy")}><Copy size={18}/>{copied ? "Gambar tersalin" : "Salin gambar"}</button>{isCatalog && pages.length > 1 && <button type="button" className="mmg-secondary" disabled={!ready || exporting} onClick={exportCatalog}><Download size={17}/>Semua halaman (ZIP)</button>}</div>
        <p className="mmg-note">PNG resolusi penuh, siap untuk WhatsApp, Instagram, dan Telegram.</p>
      </div>
    </div>
  </div>;
}
