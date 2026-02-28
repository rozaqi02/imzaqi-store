import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import Modal from "../../components/Modal";
import EmptyState from "../../components/EmptyState";

import { supabase } from "../../lib/supabaseClient";
import {
  fetchProducts,
  fetchPromoCodes,
  fetchSettings,
  fetchTestimonials,
  upsertSetting,
} from "../../lib/api";
import { formatIDR, slugify } from "../../lib/format";
import { usePageMeta } from "../../hooks/usePageMeta";
import { useToast } from "../../context/ToastContext";

const BUCKET_ICONS = "product-icons"; // public
const BUCKET_TESTIMONIALS = "testimonials"; // public

function prettyStatus(status) {
  const s = String(status || "pending");
  const map = {
    pending: "Pending",
    processing: "Diproses",
    done: "Sukses",
    // kompatibilitas status lama
    paid_reported: "Pending",
    cancelled: "Dibatalkan",
  };
  return map[s] || s;
}

function StatusBadge({ status }) {
  const s = String(status || "pending");
  const cls =
    s === "done" ? "done" : s === "processing" ? "processing" : s === "cancelled" ? "cancelled" : "pending";
  return <span className={"admin-status " + cls}>{prettyStatus(s)}</span>;
}

export default function AdminDashboard() {
  const nav = useNavigate();
  const toast = useToast();

  usePageMeta({
    title: "Admin Dashboard",
    description: "Kelola produk, varian, promo, testimoni, dan pesanan.",
  });

  const [tab, setTab] = useState("products");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [promos, setPromos] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [settings, setSettings] = useState({});

  // Products UI state
  const [productQuery, setProductQuery] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [productForm, setProductForm] = useState(null);

  // Product modal
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: "",
    slug: "",
    description: "",
    sort_order: 100,
    is_active: true,
  });

  // Variant modal
  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [variantMode, setVariantMode] = useState("create"); // create | edit
  const [variantForm, setVariantForm] = useState({
    id: "",
    product_id: "",
    name: "",
    duration_label: "",
    description: "",
    price_idr: 0,
    guarantee_text: "",
    stock: 0,
    is_active: true,
    sort_order: 100,
  });

  const waNumber = settings?.whatsapp?.number || "";

  // ===== Auth guard =====
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data?.session) nav("/admin");
    });
  }, [nav]);

  async function logout() {
    await supabase.auth.signOut();
    nav("/admin");
  }

  // ===== Fetching =====
  async function refreshProducts() {
    const p = await fetchProducts({ includeInactive: true });
    setProducts(p);
  }

  async function refreshOrders() {
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id,order_code,created_at,status,items,subtotal_idr,discount_percent,total_idr,promo_code,payment_proof_url,customer_whatsapp"
      )
      .order("created_at", { ascending: false })
      .limit(80);

    if (error) throw error;
    setOrders(data || []);
  }

  async function refreshAll() {
    setMsg("");
    const tid = toast.loading("Memuat dashboard…");

    try {
      setLoading(true);
      const [p, t, pr, s] = await Promise.all([
        fetchProducts({ includeInactive: true }),
        fetchTestimonials({ includeInactive: true }),
        fetchPromoCodes(),
        fetchSettings(),
      ]);

      setProducts(p);
      setTestimonials(t);
      setPromos(pr);
      setSettings(s);

      await refreshOrders();

      toast.remove(tid);
      toast.success("Dashboard ter-update", { duration: 1600 });
    } catch (e) {
      toast.remove(tid);
      toast.error("Gagal memuat data admin");
      setMsg(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ensure selected product exists
  useEffect(() => {
    if (!products || products.length === 0) return;
    if (selectedProductId && products.some((p) => p.id === selectedProductId)) return;
    setSelectedProductId(products[0].id);
  }, [products, selectedProductId]);

  const filteredProducts = useMemo(() => {
    const q = String(productQuery || "").trim().toLowerCase();
    if (!q) return products;
    return (products || []).filter((p) => {
      const name = String(p.name || "").toLowerCase();
      const slug = String(p.slug || "").toLowerCase();
      return name.includes(q) || slug.includes(q);
    });
  }, [products, productQuery]);

  const selectedProduct = useMemo(() => {
    return (products || []).find((p) => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  const selectedVariants = useMemo(() => {
    return (selectedProduct?.product_variants || [])
      .slice()
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }, [selectedProduct]);

  // Keep an editable form in sync with the selected product
  useEffect(() => {
    if (!selectedProduct) {
      setProductForm(null);
      return;
    }

    setProductForm({
      id: selectedProduct.id,
      name: selectedProduct.name || "",
      slug: selectedProduct.slug || "",
      description: selectedProduct.description || "",
      icon_url: selectedProduct.icon_url || "",
      is_active: !!selectedProduct.is_active,
      sort_order: Number.isFinite(selectedProduct.sort_order) ? selectedProduct.sort_order : 100,
    });
  }, [selectedProduct]);

  // ===== Helpers =====
  async function uploadToBucket(bucket, file, folder) {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
    const path = `${folder}/${Date.now()}-${Math.random().toString(16).slice(2)}.${safeExt}`;

    const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (upErr) throw upErr;

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  // ===== Products actions =====
  function openCreateProduct() {
    setNewProduct({
      name: "",
      slug: "",
      description: "",
      sort_order: 100,
      is_active: true,
    });
    setProductModalOpen(true);
  }

  async function createProduct() {
    const name = String(newProduct.name || "").trim();
    if (!name) {
      toast.error("Nama produk wajib diisi");
      return;
    }

    const slug = String(newProduct.slug || "").trim() || slugify(name);

    const tid = toast.loading("Membuat produk…");
    setMsg("");

    try {
      const { data, error } = await supabase
        .from("products")
        .insert({
          name,
          slug,
          description: String(newProduct.description || ""),
          icon_url: null,
          is_active: !!newProduct.is_active,
          sort_order: Number(newProduct.sort_order || 100),
        })
        .select("id")
        .single();

      if (error) throw error;

      await refreshProducts();
      setSelectedProductId(data?.id || "");
      setProductModalOpen(false);
      toast.remove(tid);
      toast.success("Produk dibuat", { duration: 1600 });
    } catch (e) {
      toast.remove(tid);
      toast.error("Gagal membuat produk");
      setMsg(e?.message || String(e));
    }
  }

  async function saveProduct() {
    if (!productForm?.id) return;

    const payload = {
      name: String(productForm.name || "").trim(),
      slug: String(productForm.slug || "").trim() || slugify(productForm.name),
      description: String(productForm.description || ""),
      icon_url: productForm.icon_url ? String(productForm.icon_url) : null,
      is_active: !!productForm.is_active,
      sort_order: Number(productForm.sort_order || 100),
      updated_at: new Date().toISOString(),
    };

    if (!payload.name) {
      toast.error("Nama produk wajib diisi");
      return;
    }

    const tid = toast.loading("Menyimpan produk…");
    setMsg("");

    try {
      const { error } = await supabase.from("products").update(payload).eq("id", productForm.id);
      if (error) throw error;

      await refreshProducts();
      toast.remove(tid);
      toast.success("Produk disimpan", { duration: 1400 });
    } catch (e) {
      toast.remove(tid);
      toast.error("Gagal menyimpan produk");
      setMsg(e?.message || String(e));
    }
  }

  async function deleteProduct(id) {
    if (!id) return;
    if (!window.confirm("Hapus produk ini beserta variannya?")) return;

    const tid = toast.loading("Menghapus produk…");
    setMsg("");

    try {
      // Delete variants first to avoid FK constraint errors
      const { error: vErr } = await supabase.from("product_variants").delete().eq("product_id", id);
      if (vErr) throw vErr;

      const { error: pErr } = await supabase.from("products").delete().eq("id", id);
      if (pErr) throw pErr;

      await refreshProducts();
      toast.remove(tid);
      toast.success("Produk dihapus", { duration: 1400 });
    } catch (e) {
      toast.remove(tid);
      toast.error("Gagal menghapus produk");
      setMsg(e?.message || String(e));
    }
  }

  async function uploadProductIcon(file) {
    if (!selectedProduct) return;
    if (!file) return;

    const tid = toast.loading("Upload ikon…");
    setMsg("");

    try {
      const url = await uploadToBucket(BUCKET_ICONS, file, "icons");
      const { error } = await supabase
        .from("products")
        .update({ icon_url: url, updated_at: new Date().toISOString() })
        .eq("id", selectedProduct.id);
      if (error) throw error;

      setProductForm((p) => (p ? { ...p, icon_url: url } : p));
      await refreshProducts();

      toast.remove(tid);
      toast.success("Ikon diupload", { duration: 1400 });
    } catch (e) {
      toast.remove(tid);
      toast.error("Upload gagal");
      setMsg("Upload ikon gagal. Pastikan bucket Storage public. Detail: " + (e?.message || e));
    }
  }

  // ===== Variants actions =====
  function openCreateVariant() {
    if (!selectedProduct) return;

    setVariantMode("create");
    setVariantForm({
      id: "",
      product_id: selectedProduct.id,
      name: "",
      duration_label: "",
      description: "",
      price_idr: 0,
      guarantee_text: "",
      stock: 0,
      is_active: true,
      sort_order: 100,
    });
    setVariantModalOpen(true);
  }

  function openEditVariant(v) {
    setVariantMode("edit");
    setVariantForm({
      id: v.id,
      product_id: v.product_id,
      name: v.name || "",
      duration_label: v.duration_label || "",
      description: v.description || "",
      price_idr: Number(v.price_idr || 0),
      guarantee_text: v.guarantee_text || "",
      stock: Number(v.stock || 0),
      is_active: !!v.is_active,
      sort_order: Number(v.sort_order || 100),
    });
    setVariantModalOpen(true);
  }

  async function saveVariant() {
    if (!variantForm?.product_id) return;

    const payload = {
      product_id: variantForm.product_id,
      name: String(variantForm.name || "").trim(),
      duration_label: String(variantForm.duration_label || "").trim(),
      description: String(variantForm.description || ""),
      price_idr: Number(variantForm.price_idr || 0),
      guarantee_text: String(variantForm.guarantee_text || ""),
      stock: Number(variantForm.stock || 0),
      is_active: !!variantForm.is_active,
      sort_order: Number(variantForm.sort_order || 100),
      updated_at: new Date().toISOString(),
    };

    if (!payload.name || !payload.duration_label) {
      toast.error("Nama & durasi wajib diisi");
      return;
    }

    const tid = toast.loading(variantMode === "edit" ? "Menyimpan varian…" : "Menambah varian…");
    setMsg("");

    try {
      if (variantMode === "edit") {
        const { error } = await supabase.from("product_variants").update(payload).eq("id", variantForm.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("product_variants").insert({
          ...payload,
          created_at: new Date().toISOString(),
        });
        if (error) throw error;
      }

      await refreshProducts();
      setVariantModalOpen(false);
      toast.remove(tid);
      toast.success("Varian tersimpan", { duration: 1400 });
    } catch (e) {
      toast.remove(tid);
      toast.error("Gagal menyimpan varian");
      setMsg(e?.message || String(e));
    }
  }

  async function deleteVariant(id) {
    if (!id) return;
    if (!window.confirm("Hapus varian ini?")) return;

    const tid = toast.loading("Menghapus varian…");
    setMsg("");

    try {
      const { error } = await supabase.from("product_variants").delete().eq("id", id);
      if (error) throw error;

      await refreshProducts();
      toast.remove(tid);
      toast.success("Varian dihapus", { duration: 1400 });
    } catch (e) {
      toast.remove(tid);
      toast.error("Gagal menghapus varian");
      setMsg(e?.message || String(e));
    }
  }

  // ===== Orders actions =====
  async function updateOrderStatus(orderId, status) {
    const tid = toast.loading("Update status…");
    setMsg("");

    try {
      const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
      if (error) throw error;

      await refreshOrders();
      toast.remove(tid);
      toast.success("Status diperbarui", { duration: 1200 });
    } catch (e) {
      toast.remove(tid);
      toast.error("Gagal update status");
      setMsg(e?.message || String(e));
    }
  }

  // ===== Promo actions =====
  const [promoBulk, setPromoBulk] = useState("");

  async function addPromoBulk() {
    const lines = String(promoBulk || "")
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      toast.error("Isi kode promo dulu");
      return;
    }

    // format: CODE,percent
    const rows = [];
    for (const line of lines) {
      const [codeRaw, percentRaw] = line.split(",");
      const code = String(codeRaw || "").trim().toUpperCase();
      const percent = Number(String(percentRaw || "").trim());
      if (!code || !Number.isFinite(percent)) continue;
      rows.push({ code, percent, is_active: true, updated_at: new Date().toISOString() });
    }

    if (rows.length === 0) {
      toast.error("Format salah. Contoh: DISNEY10,10");
      return;
    }

    const tid = toast.loading("Menyimpan promo…");
    setMsg("");

    try {
      const { error } = await supabase.from("promo_codes").upsert(rows, { onConflict: "code" });
      if (error) throw error;

      setPromos(await fetchPromoCodes());
      setPromoBulk("");
      toast.remove(tid);
      toast.success("Promo tersimpan", { duration: 1400 });
    } catch (e) {
      toast.remove(tid);
      toast.error("Gagal simpan promo");
      setMsg(e?.message || String(e));
    }
  }

  async function togglePromo(code, is_active) {
    const tid = toast.loading("Update promo…");
    try {
      const { error } = await supabase
        .from("promo_codes")
        .update({ is_active: !!is_active, updated_at: new Date().toISOString() })
        .eq("code", code);
      if (error) throw error;
      setPromos(await fetchPromoCodes());
      toast.remove(tid);
    } catch (e) {
      toast.remove(tid);
      toast.error("Gagal update promo");
      setMsg(e?.message || String(e));
    }
  }

  // ===== Testimonials actions (multi) =====
  async function addTestimonials(e) {
    e.preventDefault();
    setMsg("");

    const files = Array.from(e.target.elements.files.files || []);
    const caption = e.target.elements.caption.value || "";

    if (files.length === 0) {
      toast.error("Pilih minimal 1 gambar");
      return;
    }

    const tid = toast.loading("Upload testimoni…");

    try {
      const urls = [];
      for (const f of files) {
        const t = (f.type || "").toLowerCase();
        if (!(t.includes("jpeg") || t.includes("jpg") || t.includes("png") || t.includes("webp"))) {
          throw new Error("Format harus .jpeg/.jpg/.png/.webp");
        }
        urls.push(await uploadToBucket(BUCKET_TESTIMONIALS, f, "testimonials"));
      }

      const payload = urls.map((u) => ({
        image_url: u,
        caption,
        is_active: true,
        sort_order: 100,
      }));

      const { error } = await supabase.from("testimonials").insert(payload);
      if (error) throw error;

      setTestimonials(await fetchTestimonials({ includeInactive: true }));

      e.target.reset();
      toast.remove(tid);
      toast.success("Testimoni ditambah", { duration: 1400 });
    } catch (e2) {
      toast.remove(tid);
      toast.error("Gagal upload testimoni");
      setMsg(e2?.message || String(e2));
    }
  }

  async function updateTestimonial(id, patch) {
    const tid = toast.loading("Update testimoni…");
    try {
      const { error } = await supabase.from("testimonials").update(patch).eq("id", id);
      if (error) throw error;
      setTestimonials(await fetchTestimonials({ includeInactive: true }));
      toast.remove(tid);
    } catch (e) {
      toast.remove(tid);
      toast.error("Gagal update testimoni");
      setMsg(e?.message || String(e));
    }
  }

  async function deleteTestimonial(id) {
    if (!window.confirm("Hapus testimoni ini?")) return;

    const tid = toast.loading("Menghapus…");
    try {
      const { error } = await supabase.from("testimonials").delete().eq("id", id);
      if (error) throw error;
      setTestimonials(await fetchTestimonials({ includeInactive: true }));
      toast.remove(tid);
      toast.success("Dihapus", { duration: 1200 });
    } catch (e) {
      toast.remove(tid);
      toast.error("Gagal menghapus");
      setMsg(e?.message || String(e));
    }
  }

  // ===== Settings =====
  async function saveWhatsApp(number) {
    const n = String(number || "").trim();
    const tid = toast.loading("Simpan WA…");

    try {
      await upsertSetting("whatsapp", { number: n });
      setSettings(await fetchSettings());
      toast.remove(tid);
      toast.success("Disimpan", { duration: 1200 });
    } catch (e) {
      toast.remove(tid);
      toast.error("Gagal simpan");
      setMsg(e?.message || String(e));
    }
  }

  // ===== Render =====
  const tabs = [
    { id: "products", label: "Produk" },
    { id: "orders", label: "Orders" },
    { id: "promos", label: "Promo" },
    { id: "testimonials", label: "Testimoni" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <div className="page admin-page">
      <section className="section">
        <div className="container admin-shell">
          <aside className="admin-sidebar">
            <div className="admin-brand">
              <div className="admin-logo">IM</div>
              <div>
                <div className="admin-brand-title">Admin Panel</div>
                <div className="admin-brand-sub">imzaqi-store</div>
              </div>
            </div>

            <nav className="admin-nav">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  className={"admin-nav-btn " + (tab === t.id ? "active" : "")}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </nav>

            <div className="admin-sidebar-actions">
              <button className="btn btn-ghost" type="button" onClick={refreshAll}>
                Refresh
              </button>
              <button className="btn btn-danger" type="button" onClick={logout}>
                Logout
              </button>
            </div>
          </aside>

          <main className="admin-main">
            <div className="admin-topbar">
              <div>
                <h1 className="h2">Dashboard</h1>
                <div className="muted">Kelola produk & order lebih cepat.</div>
              </div>

              {loading ? <span className="admin-loading">Memuat…</span> : null}
            </div>

            {msg ? (
              <div className="admin-alert">
                <b>Info:</b> {msg}
              </div>
            ) : null}

            {tab === "products" ? (
              <div className="admin-products">
                <div className="admin-panel">
                  <div className="admin-panel-head">
                    <div>
                      <div className="admin-panel-title">Daftar Produk</div>
                      <div className="admin-panel-sub">Pilih produk untuk edit & kelola paket.</div>
                    </div>
                    <button className="btn btn-sm" onClick={openCreateProduct}>
                      + Produk
                    </button>
                  </div>

                  <div className="admin-panel-body">
                    <input
                      className="input"
                      placeholder="Cari produk…"
                      value={productQuery}
                      onChange={(e) => setProductQuery(e.target.value)}
                    />

                    <div className="admin-list" style={{ marginTop: 10 }}>
                      {(filteredProducts || []).map((p) => (
                        <button
                          key={p.id}
                          className={"admin-product-row " + (p.id === selectedProductId ? "active" : "")}
                          onClick={() => setSelectedProductId(p.id)}
                          type="button"
                        >
                          <div className="admin-product-row-left">
                            {p.icon_url ? (
                              <img className="admin-product-icon" src={p.icon_url} alt={p.name} />
                            ) : (
                              <div className="admin-product-icon admin-product-icon-fallback">
                                {String(p.name || "P").slice(0, 1).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div className="admin-product-name">{p.name}</div>
                              <div className="admin-product-sub">/{p.slug}</div>
                            </div>
                          </div>

                          <div className={"admin-product-pill " + (p.is_active ? "on" : "off")}
                            title={p.is_active ? "Aktif" : "Nonaktif"}
                          >
                            {p.is_active ? "Aktif" : "Off"}
                          </div>
                        </button>
                      ))}

                      {filteredProducts.length === 0 ? (
                        <div className="card pad" style={{ marginTop: 10 }}>
                          <EmptyState icon="🔎" title="Tidak ada" description="Produk tidak ditemukan." />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="admin-panel">
                  {!selectedProduct || !productForm ? (
                    <div className="admin-panel-body">
                      <EmptyState
                        icon="🧩"
                        title="Pilih produk"
                        description="Klik salah satu produk di kiri untuk mulai mengedit."
                      />
                    </div>
                  ) : (
                    <>
                      <div className="admin-panel-head">
                        <div>
                          <div className="admin-panel-title">Detail Produk</div>
                          <div className="admin-panel-sub">Edit info produk + upload ikon.</div>
                        </div>

                        <div className="admin-head-actions">
                          <a className="btn btn-ghost btn-sm" href={`/produk/${selectedProduct.slug}`} target="_blank" rel="noreferrer">
                            Preview
                          </a>
                          <button className="btn btn-danger btn-sm" onClick={() => deleteProduct(selectedProduct.id)}>
                            Hapus
                          </button>
                        </div>
                      </div>

                      <div className="admin-panel-body">
                        <div className="admin-form-grid">
                          <label className="admin-field">
                            <span>Nama</span>
                            <input
                              className="input"
                              value={productForm.name}
                              onChange={(e) => setProductForm((p) => ({ ...p, name: e.target.value }))}
                            />
                          </label>

                          <label className="admin-field">
                            <span>Slug</span>
                            <input
                              className="input"
                              value={productForm.slug}
                              onChange={(e) => setProductForm((p) => ({ ...p, slug: e.target.value }))}
                            />
                          </label>

                          <label className="admin-field admin-field-full">
                            <span>Deskripsi Produk</span>
                            <textarea
                              className="input admin-textarea"
                              value={productForm.description}
                              onChange={(e) => setProductForm((p) => ({ ...p, description: e.target.value }))}
                              rows={4}
                              placeholder="Deskripsi singkat untuk halaman detail…"
                            />
                          </label>

                          <label className="admin-field">
                            <span>Urutan (sort_order)</span>
                            <input
                              className="input"
                              type="number"
                              value={productForm.sort_order}
                              onChange={(e) => setProductForm((p) => ({ ...p, sort_order: Number(e.target.value) }))}
                            />
                          </label>

                          <label className="admin-field admin-field-switch">
                            <span>Aktif</span>
                            <input
                              type="checkbox"
                              checked={productForm.is_active}
                              onChange={(e) => setProductForm((p) => ({ ...p, is_active: e.target.checked }))}
                            />
                          </label>

                          <div className="admin-field admin-field-full">
                            <span>Ikon</span>
                            <div className="admin-icon-row">
                              {productForm.icon_url ? (
                                <img className="admin-icon-preview" src={productForm.icon_url} alt="preview" />
                              ) : (
                                <div className="admin-icon-preview admin-icon-fallback">No Icon</div>
                              )}
                              <div className="admin-icon-actions">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => uploadProductIcon(e.target.files?.[0])}
                                />
                                <div className="hint subtle">Upload .jpg/.png/.webp (bucket: {BUCKET_ICONS})</div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="admin-form-actions">
                          <button
                            className="btn btn-ghost"
                            type="button"
                            onClick={() => {
                              // reset
                              setProductForm({
                                id: selectedProduct.id,
                                name: selectedProduct.name || "",
                                slug: selectedProduct.slug || "",
                                description: selectedProduct.description || "",
                                icon_url: selectedProduct.icon_url || "",
                                is_active: !!selectedProduct.is_active,
                                sort_order: Number.isFinite(selectedProduct.sort_order) ? selectedProduct.sort_order : 100,
                              });
                            }}
                          >
                            Reset
                          </button>
                          <button className="btn" type="button" onClick={saveProduct}>
                            Simpan Produk
                          </button>
                        </div>

                        <div className="divider" style={{ margin: "18px 0" }} />

                        <div className="admin-panel-head" style={{ padding: 0, marginBottom: 10 }}>
                          <div>
                            <div className="admin-panel-title">Varian / Paket</div>
                            <div className="admin-panel-sub">
                              Atur harga, deskripsi varian, garansi, dan stok.
                            </div>
                          </div>

                          <button className="btn btn-sm" onClick={openCreateVariant}>
                            + Varian
                          </button>
                        </div>

                        <div className="admin-variants">
                          {selectedVariants.length === 0 ? (
                            <div className="card pad">
                              <EmptyState icon="📦" title="Belum ada varian" description="Klik +Varian untuk menambahkan paket." />
                            </div>
                          ) : (
                            selectedVariants.map((v) => (
                              <div key={v.id} className="admin-variant-row">
                                <div className="admin-variant-main">
                                  <div className="admin-variant-title">{v.name}</div>
                                  <div className="admin-variant-sub">
                                    {v.duration_label} • <b>{formatIDR(v.price_idr)}</b> • stok <b>{v.stock}</b>
                                    {!v.is_active ? " • (off)" : ""}
                                  </div>
                                  {v.description ? <div className="admin-variant-desc">{v.description}</div> : null}
                                </div>

                                <div className="admin-variant-actions">
                                  <button className="btn btn-ghost btn-sm" onClick={() => openEditVariant(v)}>
                                    Edit
                                  </button>
                                  <button className="btn btn-danger btn-sm" onClick={() => deleteVariant(v.id)}>
                                    Hapus
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : null}

            {tab === "orders" ? (
              <div className="admin-panel">
                <div className="admin-panel-head">
                  <div>
                    <div className="admin-panel-title">Orders</div>
                    <div className="admin-panel-sub">Pantau pesanan, cek bukti bayar, ubah status.</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={refreshOrders}>
                    Refresh Orders
                  </button>
                </div>

                <div className="admin-panel-body">
                  {orders.length === 0 ? (
                    <div className="card pad">
                      <EmptyState icon="🧾" title="Belum ada order" description="Order akan muncul di sini setelah ada checkout." />
                    </div>
                  ) : (
                    <div className="admin-orders">
                      {orders.map((o) => (
                        <div key={o.id} className="admin-order-card">
                          <div className="admin-order-top">
                            <div>
                              <div className="admin-order-code">{o.order_code || o.id}</div>
                              <div className="admin-order-sub">
                                {new Date(o.created_at).toLocaleString("id-ID")} • Total <b>{formatIDR(o.total_idr)}</b>
                                {o.customer_whatsapp ? ` • WA: ${o.customer_whatsapp}` : ""}
                              </div>
                            </div>

                            <div className="admin-order-right">
                              <StatusBadge status={o.status} />
                              <select
                                className="admin-select"
                                value={String(o.status || "pending")}
                                onChange={(e) => updateOrderStatus(o.id, e.target.value)}
                              >
                                <option value="pending">Pending</option>
                                <option value="processing">Diproses</option>
                                <option value="done">Sukses</option>
                                <option value="cancelled">Dibatalkan</option>
                              </select>
                            </div>
                          </div>

                          <div className="admin-order-body">
                            <div className="admin-order-items">
                              {(o.items || []).map((it, idx) => (
                                <div key={idx} className="admin-order-item">
                                  <div>
                                    <b>{it.product_name}</b>
                                    <div className="muted" style={{ fontSize: 12 }}>
                                      {it.variant_name} • {it.duration_label}
                                    </div>
                                  </div>
                                  <div>
                                    {it.qty} × {formatIDR(it.price_idr)}
                                  </div>
                                </div>
                              ))}
                            </div>

                            {o.payment_proof_url ? (
                              <a className="admin-proof" href={o.payment_proof_url} target="_blank" rel="noreferrer">
                                Lihat bukti bayar
                              </a>
                            ) : (
                              <div className="muted" style={{ fontSize: 13 }}>
                                Belum ada bukti bayar.
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {tab === "promos" ? (
              <div className="admin-panel">
                <div className="admin-panel-head">
                  <div>
                    <div className="admin-panel-title">Promo Codes</div>
                    <div className="admin-panel-sub">Tambah atau nonaktifkan kode promo.</div>
                  </div>
                </div>

                <div className="admin-panel-body">
                  <div className="admin-form-grid" style={{ marginBottom: 12 }}>
                    <label className="admin-field admin-field-full">
                      <span>Bulk input (satu baris: CODE,percent)</span>
                      <textarea
                        className="input admin-textarea"
                        value={promoBulk}
                        onChange={(e) => setPromoBulk(e.target.value)}
                        rows={4}
                        placeholder={"DISNEY10,10\nHEMAT20,20"}
                      />
                    </label>
                    <div className="admin-form-actions" style={{ justifyContent: "flex-end" }}>
                      <button className="btn" type="button" onClick={addPromoBulk}>
                        Simpan Promo
                      </button>
                    </div>
                  </div>

                  <div className="admin-promos">
                    {promos.map((p) => (
                      <div key={p.code} className="admin-promo-row">
                        <div>
                          <div className="admin-promo-code">{p.code}</div>
                          <div className="admin-promo-sub">Diskon {p.percent}%</div>
                        </div>
                        <button
                          className={"btn btn-sm " + (p.is_active ? "btn-ghost" : "")}
                          onClick={() => togglePromo(p.code, !p.is_active)}
                        >
                          {p.is_active ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {tab === "testimonials" ? (
              <div className="admin-panel">
                <div className="admin-panel-head">
                  <div>
                    <div className="admin-panel-title">Testimoni</div>
                    <div className="admin-panel-sub">Upload screenshot/chat pelanggan.</div>
                  </div>
                </div>

                <div className="admin-panel-body">
                  <form className="admin-testimonial-form" onSubmit={addTestimonials}>
                    <input name="files" type="file" accept="image/*" multiple />
                    <input name="caption" className="input" placeholder="Caption (opsional)" />
                    <button className="btn" type="submit">
                      Upload
                    </button>
                    <div className="hint subtle">Bucket: {BUCKET_TESTIMONIALS} (public)</div>
                  </form>

                  <div className="admin-grid" style={{ marginTop: 14 }}>
                    {testimonials.map((t) => (
                      <div key={t.id} className="admin-thumb">
                        <img src={t.image_url} alt={t.caption || "testimoni"} />
                        <div className="admin-thumb-actions">
                          <button
                            className={"btn btn-sm " + (t.is_active ? "btn-ghost" : "")}
                            type="button"
                            onClick={() => updateTestimonial(t.id, { is_active: !t.is_active })}
                          >
                            {t.is_active ? "Off" : "On"}
                          </button>
                          <button className="btn btn-danger btn-sm" type="button" onClick={() => deleteTestimonial(t.id)}>
                            Hapus
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {tab === "settings" ? (
              <div className="admin-panel">
                <div className="admin-panel-head">
                  <div>
                    <div className="admin-panel-title">Settings</div>
                    <div className="admin-panel-sub">Pengaturan sederhana untuk toko.</div>
                  </div>
                </div>

                <div className="admin-panel-body">
                  <div className="admin-form-grid">
                    <label className="admin-field admin-field-full">
                      <span>WhatsApp Admin</span>
                      <input
                        className="input"
                        defaultValue={waNumber}
                        placeholder="62813..."
                        onBlur={(e) => saveWhatsApp(e.target.value)}
                      />
                      <div className="hint subtle">Auto-save saat keluar dari input.</div>
                    </label>

                    <div className="card pad" style={{ marginTop: 10 }}>
                      <b>Catatan</b>
                      <div className="muted" style={{ marginTop: 6, lineHeight: 1.7 }}>
                        QRIS ditampilkan dari file <b>qris_payment.jpeg</b> di folder <b>public</b>.
                        Untuk mengganti QRIS, replace file tersebut lalu deploy ulang.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </main>
        </div>
      </section>

      {/* Create Product Modal */}
      <Modal
        open={productModalOpen}
        title="Tambah Produk"
        onClose={() => setProductModalOpen(false)}
        footer={
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setProductModalOpen(false)}>
              Batal
            </button>
            <button className="btn" onClick={createProduct}>
              Simpan
            </button>
          </div>
        }
      >
        <div className="admin-form-grid">
          <label className="admin-field">
            <span>Nama</span>
            <input
              className="input"
              value={newProduct.name}
              onChange={(e) => {
                const name = e.target.value;
                setNewProduct((p) => ({
                  ...p,
                  name,
                  slug: p.slug ? p.slug : slugify(name),
                }));
              }}
              placeholder="Netflix"
            />
          </label>

          <label className="admin-field">
            <span>Slug</span>
            <input
              className="input"
              value={newProduct.slug}
              onChange={(e) => setNewProduct((p) => ({ ...p, slug: e.target.value }))}
              placeholder="netflix"
            />
          </label>

          <label className="admin-field admin-field-full">
            <span>Deskripsi</span>
            <textarea
              className="input admin-textarea"
              value={newProduct.description}
              onChange={(e) => setNewProduct((p) => ({ ...p, description: e.target.value }))}
              rows={4}
              placeholder="Deskripsi singkat…"
            />
          </label>

          <label className="admin-field">
            <span>sort_order</span>
            <input
              className="input"
              type="number"
              value={newProduct.sort_order}
              onChange={(e) => setNewProduct((p) => ({ ...p, sort_order: Number(e.target.value) }))}
            />
          </label>

          <label className="admin-field admin-field-switch">
            <span>Aktif</span>
            <input
              type="checkbox"
              checked={newProduct.is_active}
              onChange={(e) => setNewProduct((p) => ({ ...p, is_active: e.target.checked }))}
            />
          </label>
        </div>
      </Modal>

      {/* Variant Modal */}
      <Modal
        open={variantModalOpen}
        title={variantMode === "edit" ? "Edit Varian" : "Tambah Varian"}
        onClose={() => setVariantModalOpen(false)}
        footer={
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setVariantModalOpen(false)}>
              Batal
            </button>
            <button className="btn" onClick={saveVariant}>
              Simpan
            </button>
          </div>
        }
      >
        <div className="admin-form-grid">
          <label className="admin-field">
            <span>Nama</span>
            <input className="input" value={variantForm.name} onChange={(e) => setVariantForm((p) => ({ ...p, name: e.target.value }))} />
          </label>

          <label className="admin-field">
            <span>Durasi</span>
            <input
              className="input"
              value={variantForm.duration_label}
              onChange={(e) => setVariantForm((p) => ({ ...p, duration_label: e.target.value }))}
              placeholder="1 bulan"
            />
          </label>

          <label className="admin-field admin-field-full">
            <span>Deskripsi Varian</span>
            <textarea
              className="input admin-textarea"
              value={variantForm.description}
              onChange={(e) => setVariantForm((p) => ({ ...p, description: e.target.value }))}
              rows={4}
              placeholder="Jelaskan detail paket/aturan…"
            />
          </label>

          <label className="admin-field">
            <span>Harga (IDR)</span>
            <input
              className="input"
              type="number"
              value={variantForm.price_idr}
              onChange={(e) => setVariantForm((p) => ({ ...p, price_idr: Number(e.target.value) }))}
            />
          </label>

          <label className="admin-field">
            <span>Stok</span>
            <input
              className="input"
              type="number"
              value={variantForm.stock}
              onChange={(e) => setVariantForm((p) => ({ ...p, stock: Number(e.target.value) }))}
            />
          </label>

          <label className="admin-field admin-field-full">
            <span>Garansi</span>
            <input
              className="input"
              value={variantForm.guarantee_text}
              onChange={(e) => setVariantForm((p) => ({ ...p, guarantee_text: e.target.value }))}
              placeholder="All full garansi"
            />
          </label>

          <label className="admin-field">
            <span>sort_order</span>
            <input
              className="input"
              type="number"
              value={variantForm.sort_order}
              onChange={(e) => setVariantForm((p) => ({ ...p, sort_order: Number(e.target.value) }))}
            />
          </label>

          <label className="admin-field admin-field-switch">
            <span>Aktif</span>
            <input
              type="checkbox"
              checked={variantForm.is_active}
              onChange={(e) => setVariantForm((p) => ({ ...p, is_active: e.target.checked }))}
            />
          </label>
        </div>
      </Modal>
    </div>
  );
}
