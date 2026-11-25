import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ClipboardPaste, Tag, X, ZoomIn } from "lucide-react";
import Modal from "../../../components/Modal";
import AdminPicker from "../components/AdminPicker";
import {
  PRODUCT_CATEGORIES,
  getProductCategoryMeta,
  resolveProductCategory,
  resolveTestimonialCategory,
} from "../../../lib/productCategories";
import {
  dateInputToIso,
  formatTestimonialDate,
  toDateInputValue,
} from "../../../lib/format";

const SUPPORTED_IMAGE_EXT = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};

function normalizePastedImageFile(rawBlob, index = 0) {
  if (!rawBlob) return null;
  const type = String(rawBlob.type || "").toLowerCase();
  const ext = SUPPORTED_IMAGE_EXT[type];
  if (!ext) return null;

  const existingName = typeof rawBlob.name === "string" ? rawBlob.name.trim() : "";
  const hasValidExt = /\.(png|jpe?g|webp)$/i.test(existingName);
  const fileName =
    hasValidExt && existingName !== "image.png"
      ? existingName
      : `paste-${Date.now()}-${index + 1}.${ext}`;

  if (typeof File === "function") {
    return new File([rawBlob], fileName, { type });
  }
  return Object.assign(rawBlob, { name: fileName });
}

function extractImagesFromClipboardData(clipboardData) {
  if (!clipboardData) return [];
  const extracted = [];

  if (clipboardData.items && clipboardData.items.length > 0) {
    for (let i = 0; i < clipboardData.items.length; i += 1) {
      const item = clipboardData.items[i];
      if (item?.kind === "file" && String(item.type || "").startsWith("image/")) {
        const file = normalizePastedImageFile(item.getAsFile?.(), extracted.length);
        if (file) extracted.push(file);
      }
    }
  }

  if (extracted.length === 0 && clipboardData.files && clipboardData.files.length > 0) {
    for (let i = 0; i < clipboardData.files.length; i += 1) {
      const file = normalizePastedImageFile(clipboardData.files[i], extracted.length);
      if (file) extracted.push(file);
    }
  }

  return extracted;
}

/**
 * Presentational pane: Testimoni.
 * Mengelola unggahan foto testimoni (upload file & tempel gambar clipboard) berbasis produk & kategori paket (opsional).
 */
export default function TestimonialsPane({
  activeCount = 0,
  testimonials = [],
  products = [],
  onAddTestimonials,
  onUpdateTestimonial,
  onDeleteTestimonial,
}) {
  const fileInputRef = useRef(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [purchasedDate, setPurchasedDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pasteFeedback, setPasteFeedback] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");

  const [editingItem, setEditingItem] = useState(null);
  const [editProductId, setEditProductId] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editPurchasedDate, setEditPurchasedDate] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [previewIdx, setPreviewIdx] = useState(-1);

  const getTodayInputValue = () => toDateInputValue(new Date().toISOString());

  const productsById = useMemo(() => {
    const map = new Map();
    for (const product of products || []) {
      if (product?.id) map.set(String(product.id), product);
    }
    return map;
  }, [products]);

  const productOptions = useMemo(() => {
    const sorted = [...(products || [])].sort((a, b) => {
      if (Boolean(a?.is_active) !== Boolean(b?.is_active)) return a?.is_active ? -1 : 1;
      return String(a?.name || "").localeCompare(String(b?.name || ""), "id");
    });

    return [
      {
        value: "",
        label: "Tanpa produk spesifik",
        description: "Opsional · foto tetap bisa diunggah tanpa memilih produk",
      },
      ...sorted.map((product) => {
        const catMeta = resolveProductCategory(product);
        return {
          value: String(product.id),
          label: product.name || "Produk",
          icon: product.icon_url || "",
          description: catMeta?.label || "Lainnya",
          status: product.is_active === false ? "Nonaktif" : "",
          searchText: `${product.slug || ""} ${catMeta?.label || ""}`,
        };
      }),
    ];
  }, [products]);

  const enrichedTestimonials = useMemo(() => {
    return (testimonials || []).map((item) => {
      const matchedProduct = item?.product_id ? productsById.get(String(item.product_id)) : null;
      const categoryMeta = resolveTestimonialCategory(item, products);
      const displayProductName = String(item?.product_name || matchedProduct?.name || "").trim();
      return {
        ...item,
        resolvedProductName: displayProductName,
        resolvedCategoryMeta: categoryMeta,
        resolvedCategoryKey: categoryMeta?.key || "uncategorized",
      };
    });
  }, [testimonials, products, productsById]);

  const categoryCounts = useMemo(() => {
    const counts = { all: enrichedTestimonials.length, uncategorized: 0 };
    for (const item of enrichedTestimonials) {
      if (item.resolvedCategoryKey === "uncategorized") {
        counts.uncategorized += 1;
      } else {
        counts[item.resolvedCategoryKey] = (counts[item.resolvedCategoryKey] || 0) + 1;
      }
    }
    return counts;
  }, [enrichedTestimonials]);

  const filteredTestimonials = useMemo(() => {
    if (filterCategory === "all") return enrichedTestimonials;
    return enrichedTestimonials.filter((item) => item.resolvedCategoryKey === filterCategory);
  }, [enrichedTestimonials, filterCategory]);

  const previewItem = previewIdx >= 0 ? filteredTestimonials[previewIdx] || null : null;

  const queuedPreviews = useMemo(
    () =>
      selectedFiles.map((file, idx) => ({
        key: `${file.name || "img"}-${file.size || 0}-${idx}`,
        name: file.name || `Gambar ${idx + 1}`,
        url: typeof URL?.createObjectURL === "function" ? URL.createObjectURL(file) : "",
      })),
    [selectedFiles]
  );

  useEffect(() => {
    return () => {
      if (typeof URL?.revokeObjectURL !== "function") return;
      for (const item of queuedPreviews) {
        if (item.url) URL.revokeObjectURL(item.url);
      }
    };
  }, [queuedPreviews]);

  useEffect(() => {
    setPreviewIdx(-1);
  }, [filterCategory]);

  useEffect(() => {
    if (!previewItem || filteredTestimonials.length <= 1) return undefined;
    function onKey(event) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setPreviewIdx((i) => (i - 1 + filteredTestimonials.length) % filteredTestimonials.length);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setPreviewIdx((i) => (i + 1) % filteredTestimonials.length);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [Boolean(previewItem), filteredTestimonials.length]);

  const appendImageFiles = useCallback((incomingFiles, sourceLabel = "ditambahkan") => {
    const validFiles = (incomingFiles || []).filter(Boolean);
    if (validFiles.length === 0) return false;
    setSelectedFiles((prev) => [...prev, ...validFiles]);
    setPasteFeedback(`${validFiles.length} gambar ${sourceLabel}.`);
    return true;
  }, []);

  const handlePasteEvent = useCallback(
    (event) => {
      if (editingItem || previewItem) return;
      const images = extractImagesFromClipboardData(event.clipboardData);
      if (images.length === 0) return;
      event.preventDefault();
      appendImageFiles(images, "ditempel dari clipboard");
    },
    [appendImageFiles, editingItem, previewItem]
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    window.addEventListener("paste", handlePasteEvent);
    return () => window.removeEventListener("paste", handlePasteEvent);
  }, [handlePasteEvent]);

  async function handlePasteButtonClick() {
    if (typeof navigator === "undefined" || typeof navigator.clipboard?.read !== "function") {
      setPasteFeedback("Browser tidak mendukung tombol tempel langsung — tekan Ctrl+V (atau Cmd+V) untuk menempel gambar.");
      return;
    }

    try {
      const items = await navigator.clipboard.read();
      const pasted = [];
      for (const item of items) {
        const mimeType = (item.types || []).find((type) => SUPPORTED_IMAGE_EXT[String(type || "").toLowerCase()]);
        if (!mimeType) continue;
        // eslint-disable-next-line no-await-in-loop
        const blob = await item.getType(mimeType);
        const file = normalizePastedImageFile(blob, pasted.length);
        if (file) pasted.push(file);
      }

      if (pasted.length > 0) {
        appendImageFiles(pasted, "ditempel dari clipboard");
      } else {
        setPasteFeedback("Belum ada gambar (.png/.jpg/.webp) di clipboard. Salin gambar lalu coba lagi atau tekan Ctrl+V.");
      }
    } catch {
      setPasteFeedback("Izin clipboard belum aktif — tekan Ctrl+V (atau Cmd+V) langsung di halaman ini untuk menempel gambar.");
    }
  }

  function handleFileInputChange(e) {
    const picked = Array.from(e.target.files || []);
    if (picked.length === 0) return;
    appendImageFiles(picked, "dipilih");
    e.target.value = "";
  }

  function handleRemoveQueuedFile(removeIdx) {
    setSelectedFiles((prev) => prev.filter((_, idx) => idx !== removeIdx));
    setPasteFeedback("");
  }

  function handleDropFiles(e) {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer?.files || [])
      .map((file, idx) => normalizePastedImageFile(file, idx))
      .filter(Boolean);
    if (dropped.length > 0) {
      appendImageFiles(dropped, "ditambahkan");
    }
  }

  function handleUploadProductChange(nextId) {
    const id = String(nextId || "");
    setSelectedProductId(id);
    if (!id) {
      setSelectedCategory("");
      return;
    }
    const product = productsById.get(id);
    if (product) {
      setSelectedCategory(resolveProductCategory(product).key);
    }
  }

  function handleEditProductChange(nextId) {
    const id = String(nextId || "");
    setEditProductId(id);
    if (!id) {
      setEditCategory("");
      return;
    }
    const product = productsById.get(id);
    if (product) {
      setEditCategory(resolveProductCategory(product).key);
    }
  }

  function resetUploadForm() {
    setSelectedFiles([]);
    setSelectedProductId("");
    setSelectedCategory("");
    setPurchasedDate("");
    setPasteFeedback("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmitUpload(e) {
    e.preventDefault();
    if (selectedFiles.length === 0 || submitting) return;

    const matchedProduct = selectedProductId ? productsById.get(selectedProductId) : null;
    setSubmitting(true);
    try {
      const ok = await onAddTestimonials?.({
        files: selectedFiles,
        productId: selectedProductId || null,
        productName: matchedProduct?.name || null,
        category: selectedCategory || null,
        purchasedAt: dateInputToIso(purchasedDate),
      });
      if (ok !== false) {
        resetUploadForm();
      }
    } finally {
      setSubmitting(false);
    }
  }

  function openEditCategoryModal(item) {
    const matchedById = item?.product_id ? productsById.get(String(item.product_id)) : null;
    const matchedByName = !matchedById && item?.resolvedProductName
      ? (products || []).find(
          (product) =>
            String(product?.name || "").trim().toLowerCase() === item.resolvedProductName.toLowerCase()
        )
      : null;
    const initialProductId = matchedById?.id || matchedByName?.id || "";
    const initialCategory =
      getProductCategoryMeta(item?.category)?.key ||
      item?.resolvedCategoryMeta?.key ||
      "";

    setEditingItem(item);
    setEditProductId(initialProductId ? String(initialProductId) : "");
    setEditCategory(initialCategory);
    setEditPurchasedDate(toDateInputValue(item?.purchased_at));
  }

  async function handleSaveEditCategory(e) {
    e.preventDefault();
    if (!editingItem || editSaving) return;

    const matchedProduct = editProductId ? productsById.get(editProductId) : null;
    const nextProductName = matchedProduct?.name || (editProductId ? editingItem.resolvedProductName : null) || null;
    const nextCategory = editCategory || null;

    setEditSaving(true);
    try {
      const ok = await onUpdateTestimonial?.(editingItem.id, {
        product_id: editProductId || null,
        product_name: nextProductName,
        category: nextCategory,
        purchased_at: dateInputToIso(editPurchasedDate),
      });
      if (ok !== false) {
        setEditingItem(null);
      }
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div className="admin-panel admin-panel--fill admin-testimonialsPanel admin-workspacePane">
      <div className="admin-panel-head">
        <div>
          <div className="admin-panel-title">Testimoni</div>
          <div className="admin-panel-sub">
            {activeCount} tayang · pengelompokan kategori paket produk bersifat opsional
          </div>
        </div>
      </div>

      <div className="admin-panel-body admin-panel-body--scroll">
        <p className="admin-formHint" style={{ marginBottom: 14 }}>
          <strong>Tips Upload Cepat:</strong> Pilih gambar, drag &amp; drop, atau langsung tempel screenshot dari clipboard dengan <strong>Ctrl+V</strong> / tombol <strong>Tempel gambar</strong>.
        </p>

        <form
          className="admin-testimonial-form admin-stickyTools"
          onSubmit={handleSubmitUpload}
          onReset={resetUploadForm}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDropFiles}
        >
          <label className="admin-fileBtn">
            <input
              ref={fileInputRef}
              name="files"
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileInputChange}
            />
            {selectedFiles.length > 0 ? `${selectedFiles.length} gambar siap` : "Pilih gambar"}
          </label>

          <button
            type="button"
            className="btn btn-ghost"
            onClick={handlePasteButtonClick}
          >
            <ClipboardPaste size={16} aria-hidden="true" />
            <span>Tempel gambar</span>
          </button>

          <AdminPicker
            label="Produk / Paket (opsional)"
            value={selectedProductId}
            onChange={handleUploadProductChange}
            options={productOptions}
            placeholder="Produk / paket (opsional)"
          />

          <label className="admin-field">
            <span>Kategori (opsional)</span>
            <select
              name="category"
              className="input admin-select"
              aria-label="Kategori paket produk (opsional)"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="">Tanpa kategori (opsional)</option>
              {PRODUCT_CATEGORIES.map((category) => (
                <option key={category.key} value={category.key}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>

          <label className="admin-field">
            <span>Tanggal pembelian (opsional)</span>
            <div className="admin-testimonial-dateRow">
              <input
                type="date"
                name="purchased_at"
                className="input"
                aria-label="Tanggal pembelian (opsional)"
                value={purchasedDate}
                onChange={(e) => setPurchasedDate(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setPurchasedDate(getTodayInputValue())}
              >
                Hari ini
              </button>
            </div>
          </label>

          <button
            className="btn btn-primary"
            type="submit"
            disabled={selectedFiles.length === 0 || submitting}
          >
            {submitting ? "Mengunggah..." : "Upload"}
          </button>

          {pasteFeedback ? (
            <p className="admin-formHint admin-field-full" role="status">
              {pasteFeedback}
            </p>
          ) : null}

          {queuedPreviews.length > 0 ? (
            <div className="admin-testimonial-queue admin-field-full" aria-label="Antrean gambar siap upload">
              {queuedPreviews.map((item, idx) => (
                <div key={item.key} className="admin-testimonial-queueItem">
                  {item.url ? (
                    <img
                      src={item.url}
                      alt={item.name}
                      className="admin-icon-preview"
                    />
                  ) : (
                    <span className="admin-icon-preview admin-icon-fallback">
                      {idx + 1}
                    </span>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm admin-testimonial-queueRemove"
                    onClick={() => handleRemoveQueuedFile(idx)}
                    aria-label={`Hapus ${item.name} dari antrean`}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </form>

        {enrichedTestimonials.length > 0 ? (
          <div
            className="admin-chipRow admin-chipRow--scroll"
            style={{ marginTop: 12 }}
            role="group"
            aria-label="Filter kategori testimoni"
          >
            <button
              type="button"
              className={`admin-chip ${filterCategory === "all" ? "active" : ""}`}
              onClick={() => setFilterCategory("all")}
            >
              Semua ({categoryCounts.all})
            </button>
            {PRODUCT_CATEGORIES.filter((cat) => (categoryCounts[cat.key] || 0) > 0).map((cat) => (
              <button
                key={cat.key}
                type="button"
                className={`admin-chip ${filterCategory === cat.key ? "active" : ""}`}
                onClick={() => setFilterCategory(cat.key)}
              >
                {cat.label} ({categoryCounts[cat.key]})
              </button>
            ))}
            {categoryCounts.uncategorized > 0 ? (
              <button
                type="button"
                className={`admin-chip ${filterCategory === "uncategorized" ? "active" : ""}`}
                onClick={() => setFilterCategory("uncategorized")}
              >
                Tanpa kategori ({categoryCounts.uncategorized})
              </button>
            ) : null}
          </div>
        ) : null}

        {enrichedTestimonials.length === 0 ? (
          <div className="admin-emptyInline" style={{ marginTop: 14 }}>
            Belum ada testimoni. Unggah atau tempel screenshot ulasan pelanggan untuk mulai.
          </div>
        ) : filteredTestimonials.length === 0 ? (
          <div className="admin-emptyInline" style={{ marginTop: 14 }}>
            Belum ada foto testimoni pada kategori ini.
          </div>
        ) : (
          <div className="admin-grid" style={{ marginTop: 14 }}>
            {filteredTestimonials.map((t, idx) => {
              const CategoryIcon = t.resolvedCategoryMeta?.icon || Tag;
              const badgeLabel = [
                t.resolvedProductName,
                t.resolvedCategoryMeta?.label,
              ]
                .filter(Boolean)
                .join(" · ");

              return (
                <div key={t.id} className="admin-thumb">
                  <button
                    type="button"
                    className="admin-thumb-previewBtn"
                    onClick={() => setPreviewIdx(idx)}
                    aria-label={`Lihat foto penuh testimoni ${idx + 1}${badgeLabel ? `: ${badgeLabel}` : ""}`}
                  >
                    <img
                      src={t.image_url}
                      alt={badgeLabel || "testimoni pelanggan"}
                    />
                    <span className="admin-thumb-zoom" aria-hidden="true">
                      <ZoomIn size={16} />
                    </span>
                  </button>
                  <div className="admin-thumb-meta">
                    <span className="admin-categoryTag">
                      <CategoryIcon size={12} aria-hidden="true" />
                      <span>{badgeLabel || "Tanpa kategori"}</span>
                    </span>
                    {t.purchased_at ? (
                      <div className="admin-product-sub">
                        {formatTestimonialDate(t.purchased_at)}
                      </div>
                    ) : null}
                  </div>
                  <div className="admin-thumb-actions">
                    <button
                      className={"btn btn-sm " + (t.is_active ? "btn-ghost" : "")}
                      type="button"
                      onClick={() => onUpdateTestimonial(t.id, { is_active: !t.is_active })}
                    >
                      {t.is_active ? "Off" : "On"}
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      type="button"
                      onClick={() => openEditCategoryModal(t)}
                    >
                      Detail
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      type="button"
                      onClick={() => onDeleteTestimonial(t.id)}
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        open={Boolean(editingItem)}
        title="Atur Detail Testimoni"
        onClose={() => { if (!editSaving) setEditingItem(null); }}
        size="sm"
      >
        <form onSubmit={handleSaveEditCategory} className="admin-form-grid admin-form-grid--modal">
          <p className="admin-formHint admin-field-full">
            Pilih produk, kategori paket, atau tanggal pembelian untuk foto testimoni ini. Semua kolom bersifat opsional.
          </p>

          <div className="admin-field admin-field-full">
            <AdminPicker
              label="Produk / Paket (opsional)"
              value={editProductId}
              onChange={handleEditProductChange}
              options={productOptions}
              placeholder="Tanpa produk spesifik"
            />
          </div>

          <label className="admin-field admin-field-full">
            <span>Kategori Paket (opsional)</span>
            <select
              className="input admin-select"
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value)}
            >
              <option value="">Tanpa kategori (opsional)</option>
              {PRODUCT_CATEGORIES.map((category) => (
                <option key={category.key} value={category.key}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>

          <label className="admin-field admin-field-full">
            <span>Tanggal pembelian (opsional)</span>
            <div className="admin-testimonial-dateRow">
              <input
                type="date"
                className="input"
                aria-label="Edit tanggal pembelian (opsional)"
                value={editPurchasedDate}
                onChange={(e) => setEditPurchasedDate(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setEditPurchasedDate(getTodayInputValue())}
              >
                Hari ini
              </button>
              {editPurchasedDate ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setEditPurchasedDate("")}
                >
                  Hapus
                </button>
              ) : null}
            </div>
          </label>

          <div className="modal-actions admin-field-full">
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => setEditingItem(null)}
              disabled={editSaving}
            >
              Batal
            </button>
            <button className="btn btn-primary" type="submit" disabled={editSaving}>
              {editSaving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(previewItem)}
        title={
          previewItem
            ? `Foto Testimoni ${previewIdx + 1} dari ${filteredTestimonials.length}`
            : "Foto Testimoni"
        }
        onClose={() => setPreviewIdx(-1)}
        size="lg"
      >
        {previewItem ? (
          <div className="admin-form-grid admin-form-grid--modal">
            <div className="admin-testimonial-fullImgWrap admin-field-full">
              <img
                src={previewItem.image_url}
                alt={
                  [previewItem.resolvedProductName, previewItem.resolvedCategoryMeta?.label]
                    .filter(Boolean)
                    .join(" · ") || "Foto penuh testimoni pelanggan"
                }
              />
            </div>

            <div className="admin-order-adminActions admin-field-full" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <span className="admin-categoryTag">
                {[
                  previewItem.resolvedProductName,
                  previewItem.resolvedCategoryMeta?.label,
                  formatTestimonialDate(previewItem.purchased_at),
                ]
                  .filter(Boolean)
                  .join(" · ") || "Tanpa kategori"}
              </span>

              {filteredTestimonials.length > 1 ? (
                <div className="admin-head-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() =>
                      setPreviewIdx(
                        (i) => (i - 1 + filteredTestimonials.length) % filteredTestimonials.length
                      )
                    }
                    aria-label="Foto sebelumnya"
                  >
                    <ChevronLeft size={16} />
                    <span>Sebelumnya</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setPreviewIdx((i) => (i + 1) % filteredTestimonials.length)}
                    aria-label="Foto berikutnya"
                  >
                    <span>Berikutnya</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
