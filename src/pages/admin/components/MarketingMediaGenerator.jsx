import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  Download,
  Copy,
  Sparkles,
  FileText,
  Shuffle,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  RotateCcw,
  Layers,
} from "lucide-react";
import QRCode from "qrcode";
import { formatIDR, getVariantEffectivePrice, isKnownOutOfStock } from "../../../lib/format";
import { fetchActiveFlashSales } from "../../../lib/api";
import { resolveProductCategory, resolveCatalogLine, STORE_WHATSAPP } from "../../../lib/productCategories";
import { useToast } from "../../../context/ToastContext";
import {
  MEDIA_FORMATS,
  MEDIA_STYLES,
  activeVariants,
  chooseVariant,
  liveDiscounts,
  posterOffer,
  paginateCatalog,
  buildCatalogEntries,
  normalizeMediaPhone,
} from "./marketingMediaModel";
import { drawProductPoster, drawCatalogPoster } from "./marketingMediaRenderer";
import { loadMediaImage, canvasPng, downloadMedia, mediaZip } from "./marketingMediaExport";
import AdminPicker from "./AdminPicker";
import "./MarketingMediaGenerator.css";

async function prepareCanvas(options, pageOverride) {
  await document.fonts?.ready;
  if (document.fonts?.load) {
    await Promise.all([
      document.fonts.load('700 32px "Plus Jakarta Sans"'),
      document.fonts.load('600 24px "Plus Jakarta Sans"'),
    ]);
  }
  const canvas = document.createElement("canvas");
  const catalog = options.mode === "catalog" || options.mode === "variants";
  const page = pageOverride ?? options.page;
  const items = catalog ? options.pages[page] || [] : [options.product];
  const withoutLogo = items.find((item) => !String(item.product?.icon_url || item.icon_url || "").trim());
  if (withoutLogo) {
    throw new Error(`Logo ${withoutLogo.product?.name || withoutLogo.name} belum tersedia di database. Tambahkan logo di menu Produk.`);
  }
  const url =
    options.footerMode === "reseller"
      ? `https://wa.me/${normalizeMediaPhone(options.resellerPhone || "085899508251")}`
      : catalog
        ? "https://imzaqi.store/produk"
        : options.offer.url;
  const [images, qr] = await Promise.all([
    Promise.all(items.map((item) => loadMediaImage(String(item.product?.icon_url || item.icon_url).trim()))),
    QRCode.toDataURL(url, { margin: 3, width: 320, errorCorrectionLevel: "M" }).then(loadMediaImage),
  ]);
  const missingLogo = images.findIndex((image) => !image);
  if (missingLogo !== -1) {
    throw new Error(
      `Logo ${items[missingLogo].product?.name || items[missingLogo].name} dari database gagal dimuat. Periksa URL logo di menu Produk, lalu coba lagi.`
    );
  }
  if (catalog) {
    drawCatalogPoster(canvas, {
      products: items,
      discounts: options.discounts,
      theme: options.catalogTheme,
      page: page + 1,
      pageCount: options.pages.length,
      total: options.total,
      images,
      qr,
      phone: options.phone,
      catalogScope: options.catalogScope,
      footerMode: options.footerMode,
    });
  } else {
    drawProductPoster(canvas, {
      offer: options.offer,
      styleId: options.styleId,
      format: options.format,
      variation: options.variation,
      headline: options.headline,
      badge: options.badge,
      image: images[0],
      qr,
      phone: options.phone,
      footerMode: options.footerMode,
    });
  }
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
  const [includeFlashSale, setIncludeFlashSale] = useState(true);
  const [resellerPrice, setResellerPrice] = useState(false);
  const [customVariantMarkups, setCustomVariantMarkups] = useState({});
  const [customProductMarkups, setCustomProductMarkups] = useState({});
  const [markupProductSelect, setMarkupProductSelect] = useState("");
  const [markupVariantSelect, setMarkupVariantSelect] = useState("all");
  const [markupInput, setMarkupInput] = useState("30");
  const [footerMode, setFooterMode] = useState("standard");
  const [resellerPhone, setResellerPhone] = useState("+62 858-9950-8251");
  const [sales, setSales] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [saleError, setSaleError] = useState(false);
  const [salesPending, setSalesPending] = useState(true);
  const [renderState, setRenderState] = useState({ busy: true, error: "" });
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [retry, setRetry] = useState(0);

  const canvasRef = useRef(null);
  const readyRef = useRef(null);
  const containerRef = useRef(null);
  const requestRef = useRef(0);
  const mountedRef = useRef(true);
  const copyTimer = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    let alive = true;
    fetchActiveFlashSales({ useCache: false })
      .then((data) => {
        if (alive && mountedRef.current) setSales(data);
      })
      .catch(() => {
        if (alive && mountedRef.current) setSaleError(true);
      })
      .finally(() => {
        if (alive && mountedRef.current) setSalesPending(false);
      });
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => {
      alive = false;
      mountedRef.current = false;
      clearInterval(timer);
      clearTimeout(copyTimer.current);
    };
  }, []);

  const discountKey = JSON.stringify([...liveDiscounts(sales, now)]);
  const discounts = useMemo(() => new Map(JSON.parse(discountKey)), [discountKey]);
  const activeDiscounts = useMemo(() => (includeFlashSale ? discounts : new Map()), [includeFlashSale, discounts]);

  const availableProducts = useMemo(() => {
    return products.filter((p) => {
      if (onlyActive && p.is_active === false) return false;
      if (onlyInStock) {
        const vars = Array.isArray(p.product_variants) ? p.product_variants : [];
        const validVars = onlyActive ? vars.filter((v) => v.is_active !== false) : vars;
        if (!validVars.some((v) => !isKnownOutOfStock(v))) return false;
      }
      return true;
    });
  }, [products, onlyActive, onlyInStock]);

  const product = availableProducts.find((p) => String(p.id) === productId) || availableProducts[0];
  const variants = useMemo(() => {
    let list = Array.isArray(product?.product_variants) ? product.product_variants : [];
    if (onlyActive) list = list.filter((v) => v.is_active !== false);
    if (onlyInStock) list = list.filter((v) => !isKnownOutOfStock(v));
    return list;
  }, [product, onlyActive, onlyInStock]);

  useEffect(() => {
    if (variantId && !variants.some((v) => String(v.id) === variantId)) {
      setVariantId("");
      setPrice("");
      setDuration("");
    }
  }, [variants, variantId]);

  const variant = useMemo(
    () =>
      chooseVariant(product, variantId, activeDiscounts, {
        reseller: resellerPrice,
        variantMarkups: customVariantMarkups,
        productMarkups: customProductMarkups,
      }),
    [product, variantId, activeDiscounts, resellerPrice, customVariantMarkups, customProductMarkups]
  );

  const offerResult = useMemo(() => {
    try {
      return {
        offer: posterOffer(product, variant, activeDiscounts, {
          price,
          duration,
          reseller: resellerPrice,
          variantMarkups: customVariantMarkups,
          productMarkups: customProductMarkups,
        }),
        error: "",
      };
    } catch (error) {
      return { offer: null, error: error.message };
    }
  }, [product, variant, activeDiscounts, price, duration, resellerPrice, customVariantMarkups, customProductMarkups]);

  const categories = useMemo(
    () => [...new Map(availableProducts.map((p) => { const c = resolveProductCategory(p); return [c.key, c]; })).values()],
    [availableProducts]
  );

  useEffect(() => {
    if (catalogCategory !== "all" && !categories.some((c) => c.key === catalogCategory)) {
      setCatalogCategory("all");
      setCatalogPage(0);
      setCatalogProductFilter("all");
    }
  }, [categories, catalogCategory]);

  const filtered = useMemo(
    () => availableProducts.filter((p) => catalogCategory === "all" || resolveProductCategory(p).key === catalogCategory),
    [availableProducts, catalogCategory]
  );

  const isCatalog = mode === "catalog" || mode === "variants";
  const catalogScope = mode === "variants" ? "variants" : "products";

  const catalogEntries = useMemo(() => {
    return buildCatalogEntries(
      filtered,
      catalogScope,
      activeDiscounts,
      mode === "variants" ? catalogProductFilter : "all",
      {
        onlyActive,
        onlyInStock,
        resellerPrice,
        variantMarkups: customVariantMarkups,
        productMarkups: customProductMarkups,
      }
    );
  }, [filtered, catalogScope, activeDiscounts, mode, catalogProductFilter, onlyActive, onlyInStock, resellerPrice, customVariantMarkups, customProductMarkups]);

  const pages = useMemo(() => paginateCatalog(isCatalog ? catalogEntries : filtered), [isCatalog, catalogEntries, filtered]);
  const page = Math.min(catalogPage, Math.max(0, pages.length - 1));
  const total = isCatalog ? catalogEntries.length : filtered.length;

  const getVariantDisplayPrice = useCallback(
    (v) => {
      const eff = getVariantEffectivePrice(v, activeDiscounts);
      if (!resellerPrice) return eff;
      const vId = String(v.id);
      const pId = product?.id != null ? String(product.id) : null;
      const pSlug = product?.slug != null ? String(product.slug).toLowerCase() : null;
      let m = null;
      if (customVariantMarkups[vId] != null) m = Number(customVariantMarkups[vId]);
      else if (pId && customProductMarkups[pId] != null) m = Number(customProductMarkups[pId]);
      else if (pSlug && customProductMarkups[pSlug] != null) m = Number(customProductMarkups[pSlug]);
      else m = 15;
      return m > 0 ? Math.round(eff * (1 + m / 100)) : eff;
    },
    [resellerPrice, activeDiscounts, product, customVariantMarkups, customProductMarkups]
  );

  const line = resolveCatalogLine(product);
  const phone =
    mode === "single"
      ? normalizeMediaPhone(
          settings?.whatsapp?.[line] || (line === "app_premium" && settings?.whatsapp?.number) || STORE_WHATSAPP[line]
        )
      : "";

  const options = useMemo(
    () => ({
      mode,
      product,
      offer: offerResult.offer,
      styleId,
      format,
      variation,
      headline,
      badge,
      pages,
      page,
      total,
      catalogTheme,
      phone,
      discounts: activeDiscounts,
      retry,
      catalogScope,
      resellerPrice,
      customVariantMarkups,
      customProductMarkups,
      footerMode,
      resellerPhone,
    }),
    [
      mode,
      product,
      offerResult.offer,
      styleId,
      format,
      variation,
      headline,
      badge,
      pages,
      page,
      total,
      catalogTheme,
      phone,
      activeDiscounts,
      retry,
      catalogScope,
      resellerPrice,
      customVariantMarkups,
      customProductMarkups,
      footerMode,
      resellerPhone,
    ]
  );

  const empty = mode === "single" ? !product : !catalogEntries.length;
  const invalid = mode === "single" ? offerResult.error : "";

  useEffect(() => {
    const request = ++requestRef.current;
    readyRef.current = null;
    setCopied(false);
    setRenderState({ busy: !empty && !invalid, error: invalid });
    if (empty || invalid || salesPending) return;
    const timer = setTimeout(() => {
      prepareCanvas(options)
        .then(({ canvas }) => {
          if (requestRef.current !== request || !canvasRef.current) return;
          const target = canvasRef.current;
          target.width = canvas.width;
          target.height = canvas.height;
          target.getContext("2d").drawImage(canvas, 0, 0);
          readyRef.current = { options, canvas };
          setRenderState({ busy: false, error: "" });
        })
        .catch((error) => {
          if (requestRef.current === request) {
            setRenderState({ busy: false, error: error.message || "Preview gagal dibuat. Coba lagi." });
          }
        });
    }, 140);
    return () => {
      clearTimeout(timer);
      requestRef.current++;
    };
  }, [options, empty, invalid, salesPending]);

  const ready = !empty && !invalid && !salesPending && !renderState.busy && !renderState.error && readyRef.current?.options === options;
  const filename =
    mode === "single"
      ? `imzaqi-${product?.slug || "produk"}-${styleId}-${format}${resellerPrice ? "-reseller" : ""}.png`
      : `imzaqi-katalog-${mode === "variants" ? "varian-" : ""}${catalogCategory}${resellerPrice ? "-reseller" : ""}-${page + 1}.png`;

  const exportImage = async (action) => {
    const rendered = readyRef.current;
    if (!ready || exporting || rendered?.options !== options) return;
    setExporting(true);
    try {
      const blob = canvasPng(rendered.canvas);
      blob.catch(() => {});
      if (action === "copy" && navigator.clipboard?.write && window.ClipboardItem) {
        await navigator.clipboard.write([new window.ClipboardItem({ "image/png": blob })]);
        if (mountedRef.current) setCopied(true);
        clearTimeout(copyTimer.current);
        copyTimer.current = setTimeout(() => {
          if (mountedRef.current) setCopied(false);
        }, 2200);
        toast.success("Gambar tersalin. Paste ke WhatsApp atau Telegram.");
      } else {
        downloadMedia(await blob, filename);
        toast.success(action === "copy" ? "Copy belum didukung browser ini. PNG diunduh." : "PNG berhasil diunduh.");
      }
    } catch (error) {
      toast.error(action === "copy" ? "Gambar belum bisa disalin. Gunakan Download PNG." : error.message);
    } finally {
      if (mountedRef.current) setExporting(false);
    }
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
      downloadMedia(
        await mediaZip(files),
        `imzaqi-katalog-${isVariants ? "varian-" : ""}${catalogCategory}${snapshot.resellerPrice ? "-reseller" : ""}.zip`
      );
      toast.success(`${files.length} halaman katalog diunduh dalam satu ZIP.`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      if (mountedRef.current) setExporting(false);
    }
  };

  const resetCopy = () => {
    setHeadline("");
    setBadge("");
    setPrice("");
    setDuration("");
  };

  return (
    <div className="mmg-container" ref={containerRef}>
      {/* Sleek single-row mode switcher across all screen sizes */}
      <div className="mmg-modeSwitch" aria-label="Jenis media">
        {[
          { id: "single", title: "Poster produk", shortTitle: "Poster", text: "Satu produk siap promosi", icon: Sparkles },
          { id: "catalog", title: "Katalog harga", shortTitle: "Katalog", text: "Harga mulai tiap produk", icon: FileText },
          { id: "variants", title: "Katalog semua varian", shortTitle: "Semua Paket", text: "Seluruh paket & durasi", icon: Layers },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            className={`mmg-modeCard ${mode === item.id ? "is-active" : ""}`}
            aria-pressed={mode === item.id}
            onClick={() => {
              setMode(item.id);
              setCatalogPage(0);
            }}
          >
            <item.icon size={18} aria-hidden="true" />
            <span>
              <strong className="mmg-modeTitleDesktop">{item.title}</strong>
              <strong className="mmg-modeTitleMobile">{item.shortTitle}</strong>
              <small className="mmg-modeDesc">{item.text}</small>
            </span>
          </button>
        ))}
      </div>

      <div className="mmg-layout">
        {/* Live Preview Stage (visible-first on mobile, sticky right column on desktop) */}
        <div className="mmg-stageWrap">
          <div className="mmg-previewHeading">
            <span>Preview hasil</span>
            <small>{mode === "single" ? `${MEDIA_FORMATS[format].width} × ${MEDIA_FORMATS[format].height} px` : "1200 × 1600 px / halaman"}</small>
          </div>

          <div className="mmg-canvasBox" aria-busy={renderState.busy}>
            <canvas
              ref={canvasRef}
              className={`mmg-canvasPreview ${!ready ? "is-pending" : ""}`}
              role="img"
              aria-label={
                mode === "single"
                  ? `Poster ${product?.name || "produk"}`
                  : mode === "variants"
                    ? `Katalog varian halaman ${page + 1}`
                    : `Katalog halaman ${page + 1}`
              }
            />
            {!ready && (
              <div className="mmg-previewStatus" role="status">
                {empty ? (
                  "Belum ada produk untuk ditampilkan."
                ) : (
                  renderState.error || (
                    <>
                      <LoaderCircle className="mmg-spinner" size={22} />
                      <span>Menyiapkan desain…</span>
                    </>
                  )
                )}
                {renderState.error && !invalid && (
                  <button type="button" onClick={() => setRetry((v) => v + 1)}>
                    Coba lagi
                  </button>
                )}
              </div>
            )}
          </div>

          {isCatalog && pages.length > 1 && (
            <div className="mmg-pagination">
              <button
                type="button"
                aria-label="Halaman sebelumnya"
                disabled={page === 0 || exporting}
                onClick={() => setCatalogPage(page - 1)}
              >
                <ChevronLeft size={18} />
              </button>
              <span>
                Halaman {page + 1} dari {pages.length}
              </span>
              <button
                type="button"
                aria-label="Halaman berikutnya"
                disabled={page === pages.length - 1 || exporting}
                onClick={() => setCatalogPage(page + 1)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}

          <div className="mmg-actionsBar">
            <button type="button" className="mmg-btnDownload" disabled={!ready || exporting} onClick={() => exportImage("download")}>
              <Download size={17} aria-hidden="true" />
              <span>{exporting ? "Menyiapkan…" : "Download PNG"}</span>
            </button>
            <button type="button" className="mmg-btnCopy" disabled={!ready || exporting} onClick={() => exportImage("copy")}>
              <Copy size={17} aria-hidden="true" />
              <span>{copied ? "Gambar tersalin" : "Salin gambar"}</span>
            </button>
            {isCatalog && pages.length > 1 && (
              <button type="button" className="mmg-secondary mmg-btnZip" disabled={!ready || exporting} onClick={exportCatalog}>
                <Download size={16} aria-hidden="true" />
                <span>ZIP ({pages.length})</span>
              </button>
            )}
          </div>
          <p className="mmg-note">PNG resolusi penuh, siap untuk WhatsApp, Instagram, dan Telegram.</p>
        </div>

        {/* Controls Panel (user-priority ordering: Content -> Theme -> Format -> Quick Toggles -> Advanced) */}
        <div className="mmg-controlsCard">
          {mode === "single" && (
            <>
              <div className="mmg-stepBlock">
                <AdminPicker
                  label="Produk"
                  value={product?.id || ""}
                  onChange={(id) => {
                    setProductId(String(id));
                    setVariantId("");
                    resetCopy();
                  }}
                  disabled={!availableProducts.length}
                  placeholder="Belum ada produk aktif"
                  options={availableProducts.map((p) => ({
                    value: p.id,
                    label: p.name,
                    icon: p.icon_url,
                    description: `${resolveProductCategory(p).label} · ${activeVariants(p).length} paket`,
                  }))}
                />
                <AdminPicker
                  label="Paket / varian"
                  value={variantId}
                  onChange={(id) => {
                    setVariantId(String(id));
                    setPrice("");
                    setDuration("");
                  }}
                  disabled={!variants.length}
                  options={[
                    {
                      value: "",
                      label: "Otomatis",
                      description: "Harga terendah yang tersedia",
                      meta: variant ? formatIDR(getVariantDisplayPrice(variant)) : "",
                      icon: product?.icon_url,
                    },
                    ...variants.map((v) => ({
                      value: v.id,
                      label: v.name,
                      icon: product?.icon_url,
                      description: v.duration_label || "",
                      meta: formatIDR(getVariantDisplayPrice(v)),
                      searchText: String(getVariantDisplayPrice(v)),
                      status: [
                        isKnownOutOfStock(v) ? "Stok habis" : v.stock == null || v.stock === "" ? "Stok belum diisi" : `Stok ${v.stock}`,
                        activeDiscounts.has(v.id) ? "Promo" : "",
                      ]
                        .filter(Boolean)
                        .join(" · "),
                      statusTone: isKnownOutOfStock(v) ? "muted" : "",
                    })),
                  ]}
                />
              </div>

              <fieldset className="mmg-fieldset">
                <div className="mmg-fieldsetHead">
                  <legend>Tema poster</legend>
                  <button type="button" className="mmg-shuffleBtn" onClick={() => setVariation((v) => v + 1)}>
                    <Shuffle size={13} aria-hidden="true" />
                    <span>Variasi ({(variation % 3) + 1}/3)</span>
                  </button>
                </div>
                <div className="mmg-presetGrid">
                  {MEDIA_STYLES.map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      className={`mmg-style ${s.id === styleId ? "is-selected" : ""}`}
                      aria-pressed={s.id === styleId}
                      onClick={() => setStyleId(s.id)}
                    >
                      <span className="mmg-swatches" aria-hidden="true">
                        <i style={{ background: s.bg }} />
                        <i style={{ background: s.ink }} />
                        <i style={{ background: s.accent }} />
                      </span>
                      <strong>{s.name}</strong>
                      <small>{s.detail}</small>
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="mmg-fieldset">
                <legend>Ukuran gambar</legend>
                <div className="mmg-formats">
                  {Object.entries(MEDIA_FORMATS).map(([id, f]) => (
                    <button
                      type="button"
                      key={id}
                      aria-pressed={format === id}
                      className={format === id ? "is-selected" : ""}
                      onClick={() => setFormat(id)}
                    >
                      <strong>{f.ratio}</strong>
                      <small>{f.label}</small>
                    </button>
                  ))}
                </div>
              </fieldset>
            </>
          )}

          {mode === "catalog" && (
            <>
              <AdminPicker
                label="Kategori"
                value={catalogCategory}
                onChange={(key) => {
                  setCatalogCategory(key);
                  setCatalogPage(0);
                }}
                options={[
                  { value: "all", label: "Semua kategori", meta: `${availableProducts.length} produk` },
                  ...categories.map((c) => ({
                    value: c.key,
                    label: c.label,
                    meta: `${availableProducts.filter((p) => resolveProductCategory(p).key === c.key).length} produk`,
                  })),
                ]}
              />
              <fieldset className="mmg-fieldset">
                <legend>Tema katalog</legend>
                <div className="mmg-formats">
                  {[
                    { id: "emerald", name: "Kertas & hijau", dot: "#059669" },
                    { id: "dark", name: "Onyx & lime", dot: "#34d399" },
                  ].map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      className={catalogTheme === s.id ? "is-selected" : ""}
                      aria-pressed={catalogTheme === s.id}
                      onClick={() => setCatalogTheme(s.id)}
                    >
                      <span className="mmg-themeOptionLabel">
                        <i className="mmg-themeDot" style={{ background: s.dot }} aria-hidden="true" />
                        <strong>{s.name}</strong>
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <p className="mmg-note">
                {filtered.length} produk {onlyInStock ? "ready stok" : "aktif"} · {pages.length} halaman (maks. 10/halaman).
              </p>
            </>
          )}

          {mode === "variants" && (
            <>
              <AdminPicker
                label="Kategori"
                value={catalogCategory}
                onChange={(key) => {
                  setCatalogCategory(key);
                  setCatalogPage(0);
                }}
                options={[
                  { value: "all", label: "Semua kategori", meta: `${availableProducts.length} produk` },
                  ...categories.map((c) => ({
                    value: c.key,
                    label: c.label,
                    meta: `${availableProducts.filter((p) => resolveProductCategory(p).key === c.key).length} produk`,
                  })),
                ]}
              />
              <AdminPicker
                label="Filter produk (opsional)"
                value={catalogProductFilter}
                onChange={(id) => {
                  setCatalogProductFilter(id);
                  setCatalogPage(0);
                }}
                options={[
                  { value: "all", label: "Semua produk", meta: `${filtered.length} produk` },
                  ...filtered.map((p) => ({
                    value: String(p.id),
                    label: p.name,
                    icon: p.icon_url,
                    meta: `${activeVariants(p).length} paket`,
                  })),
                ]}
              />
              <fieldset className="mmg-fieldset">
                <legend>Tema katalog</legend>
                <div className="mmg-formats">
                  {[
                    { id: "emerald", name: "Kertas & hijau", dot: "#059669" },
                    { id: "dark", name: "Onyx & lime", dot: "#34d399" },
                  ].map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      className={catalogTheme === s.id ? "is-selected" : ""}
                      aria-pressed={catalogTheme === s.id}
                      onClick={() => setCatalogTheme(s.id)}
                    >
                      <span className="mmg-themeOptionLabel">
                        <i className="mmg-themeDot" style={{ background: s.dot }} aria-hidden="true" />
                        <strong>{s.name}</strong>
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <p className="mmg-note">
                {catalogEntries.length} paket / varian {onlyInStock ? "ready stok" : "aktif"} · {pages.length} halaman.
              </p>
            </>
          )}

          {/* Compact Filter & Reseller Chip Row */}
          <fieldset className="mmg-fieldset">
            <legend>Filter &amp; penyesuaian harga</legend>
            <div className="mmg-filterRow">
              <label className={`mmg-checkLabel ${onlyActive ? "is-checked" : ""}`}>
                <input
                  type="checkbox"
                  checked={onlyActive}
                  onChange={(e) => {
                    setOnlyActive(e.target.checked);
                    setCatalogPage(0);
                  }}
                />
                <span>Hanya produk aktif</span>
              </label>
              <label className={`mmg-checkLabel ${onlyInStock ? "is-checked" : ""}`}>
                <input
                  type="checkbox"
                  checked={onlyInStock}
                  onChange={(e) => {
                    setOnlyInStock(e.target.checked);
                    setCatalogPage(0);
                  }}
                />
                <span>Hanya ready stok</span>
              </label>
              <label className={`mmg-checkLabel ${includeFlashSale ? "is-checked" : ""}`}>
                <input
                  type="checkbox"
                  checked={includeFlashSale}
                  onChange={(e) => {
                    setIncludeFlashSale(e.target.checked);
                    setCatalogPage(0);
                  }}
                />
                <span>Tampilkan harga flash sale jika ada</span>
              </label>
              <label className={`mmg-checkLabel ${resellerPrice ? "is-checked" : ""}`}>
                <input
                  type="checkbox"
                  checked={resellerPrice}
                  onChange={(e) => {
                    setResellerPrice(e.target.checked);
                    setCatalogPage(0);
                  }}
                />
                <span>Harga reseller (15%)</span>
              </label>
            </div>

            {resellerPrice && (
              <div className="mmg-customMarkupsCard">
                <div className="mmg-customMarkupsTitle">Custom markup reseller per varian / produk</div>
                <p className="mmg-note">
                  Bawaan harga reseller +15%. Atur persentase khusus untuk produk atau varian tertentu.
                </p>
                <div className="mmg-customMarkupsRow">
                  <div className="mmg-field">
                    <label htmlFor="mmg-markup-prod">Pilih produk</label>
                    <select
                      id="mmg-markup-prod"
                      value={markupProductSelect}
                      onChange={(e) => {
                        setMarkupProductSelect(e.target.value);
                        setMarkupVariantSelect("all");
                      }}
                    >
                      <option value="">-- Pilih produk --</option>
                      {availableProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mmg-field">
                    <label htmlFor="mmg-markup-var">Pilih varian</label>
                    <select
                      id="mmg-markup-var"
                      value={markupVariantSelect}
                      disabled={!markupProductSelect}
                      onChange={(e) => setMarkupVariantSelect(e.target.value)}
                    >
                      <option value="all">Semua varian produk ini</option>
                      {(() => {
                        const selectedProd = availableProducts.find((p) => String(p.id) === String(markupProductSelect));
                        const vars = activeVariants(selectedProd);
                        return vars.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name} {v.duration_label ? `(${v.duration_label})` : ""}
                          </option>
                        ));
                      })()}
                    </select>
                  </div>
                  <div className="mmg-field" style={{ maxWidth: 110 }}>
                    <label htmlFor="mmg-markup-val">Markup (%)</label>
                    <input
                      id="mmg-markup-val"
                      type="number"
                      min="0"
                      max="500"
                      value={markupInput}
                      onChange={(e) => setMarkupInput(e.target.value)}
                      placeholder="30"
                    />
                  </div>
                  <button
                    type="button"
                    className="mmg-secondary"
                    disabled={!markupProductSelect || markupInput === ""}
                    onClick={() => {
                      const val = Number(markupInput);
                      if (isNaN(val) || val < 0) return;
                      if (markupVariantSelect === "all") {
                        setCustomProductMarkups((prev) => ({ ...prev, [markupProductSelect]: val }));
                      } else {
                        setCustomVariantMarkups((prev) => ({ ...prev, [markupVariantSelect]: val }));
                      }
                    }}
                  >
                    Terapkan
                  </button>
                </div>

                {(Object.keys(customProductMarkups).length > 0 || Object.keys(customVariantMarkups).length > 0) && (
                  <div className="mmg-markupTags">
                    {Object.entries(customProductMarkups).map(([pId, percent]) => {
                      const prod = availableProducts.find((p) => String(p.id) === String(pId));
                      const name = prod?.name || `Produk #${pId}`;
                      return (
                        <span key={`p-${pId}`} className="mmg-markupTag">
                          <span>
                            {name} (Semua varian): +{percent}%
                          </span>
                          <button
                            type="button"
                            aria-label={`Hapus custom markup ${name}`}
                            onClick={() =>
                              setCustomProductMarkups((prev) => {
                                const n = { ...prev };
                                delete n[pId];
                                return n;
                              })
                            }
                          >
                            &times;
                          </button>
                        </span>
                      );
                    })}
                    {Object.entries(customVariantMarkups).map(([vId, percent]) => {
                      let varName = `Varian #${vId}`;
                      for (const p of availableProducts) {
                        const v = (p.product_variants || []).find((item) => String(item.id) === String(vId));
                        if (v) {
                          varName = `${p.name} - ${v.name}`;
                          break;
                        }
                      }
                      return (
                        <span key={`v-${vId}`} className="mmg-markupTag">
                          <span>
                            {varName}: +{percent}%
                          </span>
                          <button
                            type="button"
                            aria-label={`Hapus custom markup ${varName}`}
                            onClick={() =>
                              setCustomVariantMarkups((prev) => {
                                const n = { ...prev };
                                delete n[vId];
                                return n;
                              })
                            }
                          >
                            &times;
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </fieldset>

          {/* Footer & Custom Text Accordion */}
          <fieldset className="mmg-fieldset">
            <legend>Opsi footer &amp; QR code</legend>
            <div className="mmg-formats">
              <button
                type="button"
                className={footerMode === "standard" ? "is-selected" : ""}
                aria-pressed={footerMode === "standard"}
                onClick={() => setFooterMode("standard")}
              >
                <strong>Standar</strong>
                <small>Web imzaqi.store</small>
              </button>
              <button
                type="button"
                className={footerMode === "reseller" ? "is-selected" : ""}
                aria-pressed={footerMode === "reseller"}
                onClick={() => setFooterMode("reseller")}
              >
                <strong>Khusus Reseller</strong>
                <small>WhatsApp &amp; stok</small>
              </button>
            </div>
            {footerMode === "reseller" && (
              <div className="mmg-resellerPhoneWrap" style={{ marginTop: 10 }}>
                <label className="mmg-field">
                  Nomor WhatsApp Reseller
                  <input
                    type="text"
                    value={resellerPhone}
                    onChange={(e) => setResellerPhone(e.target.value)}
                    placeholder="+62 858-9950-8251"
                  />
                </label>
                <small className="mmg-note" style={{ display: "block" }}>
                  QR terhubung ke <strong>https://wa.me/{normalizeMediaPhone(resellerPhone || "085899508251")}</strong>.
                </small>
              </div>
            )}
          </fieldset>

          {mode === "single" && (
            <details className="mmg-customize">
              <summary>Ubah teks &amp; harga</summary>
              <div>
                <label className="mmg-field">
                  Headline
                  <input
                    maxLength={70}
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder="Kosongkan untuk headline bawaan"
                  />
                </label>
                <label className="mmg-field">
                  Label kecil
                  <input
                    maxLength={45}
                    value={badge}
                    onChange={(e) => setBadge(e.target.value)}
                    placeholder="Contoh: PILIHAN MINGGU INI"
                  />
                </label>
                <label className="mmg-field">
                  Harga manual (Rp)
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder={String(offerResult.offer?.price || "Harga dari paket")}
                  />
                </label>
                <label className="mmg-field">
                  Durasi / keterangan
                  <input
                    maxLength={70}
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder={variant?.duration_label || "Mengikuti paket"}
                  />
                </label>
                {resellerPrice && variant && (
                  <label className="mmg-field">
                    Markup reseller varian ini (%)
                    <input
                      type="number"
                      min="0"
                      max="500"
                      value={customVariantMarkups[variant.id] ?? (product?.id && customProductMarkups[product.id]) ?? 15}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (!isNaN(val) && val >= 0) {
                          setCustomVariantMarkups((prev) => ({ ...prev, [variant.id]: val }));
                        }
                      }}
                    />
                  </label>
                )}
                <button type="button" className="mmg-secondary" onClick={resetCopy}>
                  <RotateCcw size={15} aria-hidden="true" />
                  <span>Kembalikan teks &amp; harga</span>
                </button>
              </div>
            </details>
          )}

          {saleError && <p className="mmg-warning">Flash sale belum berhasil dimuat. Harga mengikuti harga dasar paket.</p>}
        </div>
      </div>
    </div>
  );
}
