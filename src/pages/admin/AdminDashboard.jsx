import React, { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Box,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Eye,
  LayoutDashboard,
  Search,
  Settings2,
  Star,
  Tags,
  Wallet,
} from "lucide-react";

import Modal from "../../components/Modal";
import EmptyState from "../../components/EmptyState";
import FlowAssist from "../../components/FlowAssist";

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
const CATEGORY_OPTIONS = [
  { value: "streaming", label: "Streaming" },
  { value: "music", label: "Music" },
  { value: "tools", label: "Tools" },
  { value: "learning", label: "Belajar" },
  { value: "other", label: "Lainnya" },
];
const ORDER_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "paid_reported", label: "Lapor Bayar" },
  { value: "processing", label: "Diproses" },
  { value: "done", label: "Sukses" },
  { value: "cancelled", label: "Dibatalkan" },
];
const LIVE_ORDER_STATUSES = new Set(["pending", "paid_reported", "processing"]);
const ANALYTICS_WINDOWS = [
  { value: "7d", label: "7 hari" },
  { value: "30d", label: "30 hari" },
];
const ORDER_SELECT_FULL =
  "id,order_code,created_at,status,items,subtotal_idr,discount_percent,total_idr,promo_code,payment_proof_url,customer_whatsapp,notes,admin_note";
const ORDER_SELECT_FALLBACK =
  "id,order_code,created_at,status,items,subtotal_idr,discount_percent,total_idr,promo_code,payment_proof_url,customer_whatsapp";
const CATEGORY_LABELS = CATEGORY_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

function getSafeOrderItems(order) {
  return Array.isArray(order?.items) ? order.items : [];
}

function prettyStatus(status) {
  const s = String(status || "pending");
  const map = {
    pending: "Pending",
    processing: "Diproses",
    done: "Sukses",
    paid_reported: "Lapor Bayar",
    cancelled: "Dibatalkan",
  };
  return map[s] || s;
}

function getStatusTone(status) {
  const s = String(status || "pending");
  if (s === "done") return "done";
  if (s === "processing") return "processing";
  if (s === "paid_reported") return "reported";
  if (s === "cancelled") return "cancelled";
  return "pending";
}

function StatusBadge({ status }) {
  return <span className={"admin-status " + getStatusTone(status)}>{prettyStatus(status)}</span>;
}

const TAB_ICONS = {
  overview: LayoutDashboard,
  products: Box,
  orders: ClipboardList,
  promos: Tags,
  testimonials: Star,
  settings: Settings2,
};

function getOrderItemCount(order) {
  return getSafeOrderItems(order).reduce((sum, item) => sum + Number(item?.qty || 0), 0);
}

function getOrderDiscountAmount(order) {
  const subtotal = Number(order?.subtotal_idr || 0);
  const total = Number(order?.total_idr || 0);
  return Math.max(0, subtotal - total);
}

function prettyCategory(category) {
  return CATEGORY_LABELS[String(category || "other").toLowerCase()] || CATEGORY_LABELS.other;
}

function formatCompactNumber(value) {
  return new Intl.NumberFormat("id-ID", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value || 0));
}

function formatCompactIDR(value) {
  const amount = Number(value || 0);
  if (Math.abs(amount) >= 1000000) {
    return `Rp${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(amount / 1000000)} jt`;
  }
  if (Math.abs(amount) >= 1000) {
    return `Rp${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(amount / 1000)} rb`;
  }
  return formatIDR(amount);
}

function formatPercent(value, digits = 0) {
  return `${Number(value || 0).toFixed(digits)}%`;
}

function formatAdminDate(value) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDayLabel(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
  }).format(date);
}

function toDateKeyWIB(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function normalizeWhatsApp(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

function buildWhatsAppLink(value) {
  const digits = normalizeWhatsApp(value);
  return digits ? `https://wa.me/${digits}` : "";
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Number(value || 0)));
}

export default function AdminDashboard() {
  const nav = useNavigate();
  const toast = useToast();

  usePageMeta({
    title: "Admin Dashboard",
    description: "Kelola produk, varian, promo, testimoni, dan pesanan.",
  });

  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState("");

  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [adminNoteDrafts, setAdminNoteDrafts] = useState({});
  const [promos, setPromos] = useState([]);
  const [promoClaims, setPromoClaims] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [settings, setSettings] = useState({});
  const [storePulse, setStorePulse] = useState({
    total_views: 0,
    today_views: 0,
    total_orders: 0,
    today_orders: 0,
  });
  const [analyticsWindow, setAnalyticsWindow] = useState("7d");

  // Products UI state
  const [productQuery, setProductQuery] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [productForm, setProductForm] = useState(null);
  const [orderQuery, setOrderQuery] = useState("");
  const [orderBucket, setOrderBucket] = useState("all");
  const [expandedOrderId, setExpandedOrderId] = useState("");

  // Product modal
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: "",
    slug: "",
    category: "other",
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

  const [promoBulk, setPromoBulk] = useState("");
  const [settingsWhatsApp, setSettingsWhatsApp] = useState("");
  const [settingsQrisBase, setSettingsQrisBase] = useState("");
  const [settingsQrisImageUrl, setSettingsQrisImageUrl] = useState("");
  const deferredProductQuery = useDeferredValue(productQuery);
  const deferredOrderQuery = useDeferredValue(orderQuery);
  const waNumber = settings?.whatsapp?.number || "";
  const savedQrisBase = String(settings?.qris?.base_payload || "").trim();
  const envQrisBase = String(process.env.REACT_APP_QRIS_BASE || "").trim();
  const qrisModeLabel = savedQrisBase || envQrisBase ? "Auto aktif" : "Fallback statis";
  const qrisModeCopy = savedQrisBase
    ? "Base QR tersimpan di database."
    : envQrisBase
      ? "Base QR masih ikut env build."
      : "Base QR kosong. Checkout akan pakai QR statis.";

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
  useEffect(() => {
    setSettingsWhatsApp(waNumber);
  }, [waNumber]);

  useEffect(() => {
    const qris = settings?.qris || {};
    setSettingsQrisBase(String(qris.base_payload || ""));
    setSettingsQrisImageUrl(String(qris.image_url || ""));
  }, [settings]);

  async function fetchOrdersData() {
    let query = supabase.from("orders").select(ORDER_SELECT_FULL).order("created_at", { ascending: false }).limit(1000);
    let { data, error } = await query;

    if (error && /(notes|admin_note)/i.test(String(error?.message || ""))) {
      ({ data, error } = await supabase
        .from("orders")
        .select(ORDER_SELECT_FALLBACK)
        .order("created_at", { ascending: false })
        .limit(1000));
    }

    if (error) throw error;
    return data || [];
  }

  async function fetchPromoClaimsData() {
    try {
      const { data, error } = await supabase
        .from("promo_claims")
        .select("id,visitor_id,code,claimed_at")
        .order("claimed_at", { ascending: false })
        .limit(1000);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.warn("Gagal memuat promo_claims", error);
      return [];
    }
  }

  async function fetchStorePulse() {
    try {
      const { data: stats, error } = await supabase.rpc("get_public_stats");
      if (!error && stats) {
        return {
          total_views: Number(stats.total_views || 0),
          today_views: Number(stats.today_views || 0),
          total_orders: Number(stats.total_orders || 0),
          today_orders: Number(stats.today_orders || 0),
        };
      }
    } catch (error) {
      console.warn("Gagal memuat get_public_stats", error);
    }

    try {
      const { data, error } = await supabase.from("site_stats").select("total_views,today_views,last_date").maybeSingle();
      if (!error && data) {
        return {
          total_views: Number(data.total_views || 0),
          today_views: Number(data.today_views || 0),
          total_orders: 0,
          today_orders: 0,
          last_date: data.last_date || "",
        };
      }
    } catch (error) {
      console.warn("Gagal memuat site_stats", error);
    }

    return {
      total_views: 0,
      today_views: 0,
      total_orders: 0,
      today_orders: 0,
    };
  }

  async function loadOrdersAndPulse() {
    const [nextOrders, nextPulse] = await Promise.all([fetchOrdersData(), fetchStorePulse()]);
    setOrders(nextOrders);
    setStorePulse(nextPulse);
    setLastSyncedAt(new Date().toISOString());
    return nextOrders;
  }

  async function refreshProducts() {
    const nextProducts = await fetchProducts({ includeInactive: true });
    setProducts(nextProducts);
    return nextProducts;
  }

  async function refreshOrders() {
    const [nextOrders, nextClaims] = await Promise.all([loadOrdersAndPulse(), fetchPromoClaimsData()]);
    setPromoClaims(nextClaims);
    return nextOrders;
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

  useEffect(() => {
    const next = {};
    (orders || []).forEach((order) => {
      next[order.id] = String(order.admin_note || "");
    });
    setAdminNoteDrafts(next);
  }, [orders]);

  const filteredProducts = useMemo(() => {
    const q = String(deferredProductQuery || "").trim().toLowerCase();
    if (!q) return products;
    return (products || []).filter((p) => {
      const name = String(p.name || "").toLowerCase();
      const slug = String(p.slug || "").toLowerCase();
      return name.includes(q) || slug.includes(q);
    });
  }, [deferredProductQuery, products]);

  const selectedProduct = useMemo(() => {
    return (products || []).find((p) => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  const selectedVariants = useMemo(() => {
    return (selectedProduct?.product_variants || [])
      .slice()
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }, [selectedProduct]);

  const allVariants = useMemo(() => {
    return (products || []).flatMap((product) => product.product_variants || []);
  }, [products]);

  const analyticsDays = analyticsWindow === "30d" ? 30 : 7;

  const analyticsSummary = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - (analyticsDays - 1));
    start.setHours(0, 0, 0, 0);

    const todayKey = toDateKeyWIB(now);
    const orderRows = Array.isArray(orders) ? orders : [];
    const productMap = new Map((products || []).map((product) => [product.id, product]));
    const trendMap = new Map();

    for (let offset = analyticsDays - 1; offset >= 0; offset -= 1) {
      const day = new Date(now);
      day.setDate(day.getDate() - offset);
      const key = toDateKeyWIB(day);
      trendMap.set(key, { key, label: formatDayLabel(day), orders: 0, revenue: 0 });
    }

    const statusMap = ORDER_STATUS_OPTIONS.reduce((acc, option) => {
      acc[option.value] = 0;
      return acc;
    }, {});

    const topProductsMap = new Map();
    const categoryMap = new Map();
    const promoUsageMap = new Map();

    let revenueTotal = 0;
    let revenueWindow = 0;
    let todayRevenue = 0;
    let todayOrders = 0;
    let doneOrders = 0;
    let pipelineValue = 0;
    let discountTotal = 0;

    orderRows.forEach((order) => {
      const status = String(order?.status || "pending");
      const createdAt = new Date(order?.created_at || Date.now());
      const total = Number(order?.total_idr || 0);
      const discountAmount = getOrderDiscountAmount(order);
      const orderKey = toDateKeyWIB(createdAt);
      const inWindow = createdAt >= start;

      statusMap[status] = (statusMap[status] || 0) + 1;

      if (LIVE_ORDER_STATUSES.has(status)) {
        pipelineValue += total;
      }

      if (status === "done") {
        revenueTotal += total;
        doneOrders += 1;
        discountTotal += discountAmount;

        if (inWindow) revenueWindow += total;
        if (orderKey === todayKey) todayRevenue += total;
      }

      if (orderKey === todayKey) {
        todayOrders += 1;
      }

      if (inWindow && trendMap.has(orderKey)) {
        const point = trendMap.get(orderKey);
        point.orders += 1;
        if (status === "done") point.revenue += total;
      }

      if (order?.promo_code) {
        const code = String(order.promo_code).toUpperCase();
        const promoEntry = promoUsageMap.get(code) || { code, orders: 0, revenue: 0 };
        promoEntry.orders += 1;
        promoEntry.revenue += total;
        promoUsageMap.set(code, promoEntry);
      }

      getSafeOrderItems(order).forEach((item) => {
        const label = String(item?.product_name || item?.variant_name || "Tanpa nama");
        const qty = Number(item?.qty || 0);
        const revenue = Number(item?.price_idr || 0) * qty;
        const productEntry = topProductsMap.get(label) || { name: label, quantity: 0, revenue: 0 };
        productEntry.quantity += qty;
        productEntry.revenue += revenue;
        topProductsMap.set(label, productEntry);

        const productId = item?.product_id;
        const category = prettyCategory(productMap.get(productId)?.category || "other");
        const categoryEntry = categoryMap.get(category) || { category, quantity: 0, revenue: 0 };
        categoryEntry.quantity += qty;
        categoryEntry.revenue += revenue;
        categoryMap.set(category, categoryEntry);
      });
    });

    const stockAlerts = allVariants
      .filter((variant) => variant?.is_active && Number(variant?.stock || 0) <= 3)
      .sort((a, b) => Number(a?.stock || 0) - Number(b?.stock || 0))
      .slice(0, 6);

    const trend = Array.from(trendMap.values());
    const maxOrders = Math.max(1, ...trend.map((point) => point.orders));
    const maxRevenue = Math.max(1, ...trend.map((point) => point.revenue));

    return {
      revenueTotal,
      revenueWindow,
      todayRevenue,
      todayOrders,
      doneOrders,
      pipelineValue,
      discountTotal,
      averageOrderValue: doneOrders ? revenueTotal / doneOrders : 0,
      trend,
      maxOrders,
      maxRevenue,
      statusMap,
      topProducts: Array.from(topProductsMap.values())
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5),
      categories: Array.from(categoryMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 4),
      promoUsage: Array.from(promoUsageMap.values())
        .sort((a, b) => b.orders - a.orders)
        .slice(0, 5),
      stockAlerts,
      conversionRatio: storePulse.total_views ? (orders.length / storePulse.total_views) * 100 : 0,
      activeProducts: (products || []).filter((product) => product.is_active).length,
      inactiveProducts: (products || []).filter((product) => !product.is_active).length,
      activePromos: (promos || []).filter((promo) => promo.is_active).length,
      activeTestimonials: (testimonials || []).filter((item) => item.is_active).length,
    };
  }, [allVariants, analyticsDays, orders, products, promos, storePulse.total_views, testimonials]);

  const testimonialsWithoutCaption = useMemo(
    () => (testimonials || []).filter((item) => item.is_active && !String(item.caption || "").trim()).length,
    [testimonials]
  );

  const dashboardStats = useMemo(() => {
    return [
      {
        key: "revenue",
        label: `Revenue ${analyticsWindow}`,
        value: formatCompactIDR(analyticsSummary.revenueWindow),
        helper: `${analyticsSummary.doneOrders} order sukses`,
        icon: Wallet,
      },
      {
        key: "pipeline",
        label: "Butuh tindak lanjut",
        value: `${orders.filter((order) => LIVE_ORDER_STATUSES.has(String(order.status || "pending"))).length}`,
        helper: formatCompactIDR(analyticsSummary.pipelineValue),
        icon: ClipboardList,
      },
      {
        key: "traffic",
        label: "Views hari ini",
        value: formatCompactNumber(storePulse.today_views),
        helper: `${storePulse.today_orders || analyticsSummary.todayOrders} order masuk`,
        icon: Eye,
      },
      {
        key: "stock",
        label: "Stok menipis",
        value: `${analyticsSummary.stockAlerts.length}`,
        helper: analyticsSummary.stockAlerts.length ? "Perlu restock" : "Semua aman",
        icon: AlertTriangle,
      },
    ];
  }, [analyticsSummary, analyticsWindow, orders, storePulse.today_orders, storePulse.today_views]);

  const orderStats = useMemo(() => {
    return {
      total: orders.length,
      live: orders.filter((order) => LIVE_ORDER_STATUSES.has(String(order.status || "pending"))).length,
      done: orders.filter((order) => String(order.status || "pending") === "done").length,
      cancelled: orders.filter((order) => String(order.status || "pending") === "cancelled").length,
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const query = String(deferredOrderQuery || "").trim().toLowerCase();

    return (orders || []).filter((order) => {
      const status = String(order?.status || "pending");
      const matchesBucket =
        orderBucket === "all"
          ? true
          : orderBucket === "attention"
            ? LIVE_ORDER_STATUSES.has(status)
            : status === orderBucket;

      if (!matchesBucket) return false;
      if (!query) return true;

      const haystacks = [
        order?.order_code,
        order?.customer_whatsapp,
        order?.promo_code,
        order?.notes,
        order?.admin_note,
        ...getSafeOrderItems(order).flatMap((item) => [item?.product_name, item?.variant_name, item?.duration_label]),
      ];

      return haystacks.some((value) => String(value || "").toLowerCase().includes(query));
    });
  }, [deferredOrderQuery, orderBucket, orders]);

  const expandedOrder = useMemo(() => {
    return filteredOrders.find((order) => order.id === expandedOrderId) || null;
  }, [expandedOrderId, filteredOrders]);

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
      category: selectedProduct.category || "other",
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
      category: "other",
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
          category: String(newProduct.category || "other"),
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
      category: String(productForm.category || "other"),
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

  async function saveOrderAdminNote(orderId) {
    const tid = toast.loading("Simpan catatan...");
    setMsg("");

    try {
      const admin_note = String(adminNoteDrafts[orderId] || "").trim() || null;
      const { error } = await supabase.from("orders").update({ admin_note }).eq("id", orderId);
      if (error) throw error;

      await refreshOrders();
      toast.remove(tid);
      toast.success("Catatan admin disimpan", { duration: 1200 });
    } catch (e) {
      toast.remove(tid);
      toast.error("Gagal simpan catatan admin");
      setMsg(e?.message || String(e));
    }
  }

  // ===== Promo actions =====

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
      setSettingsWhatsApp(n);
      toast.remove(tid);
      toast.success("Disimpan", { duration: 1200 });
    } catch (e) {
      toast.remove(tid);
      toast.error("Gagal simpan");
      setMsg(e?.message || String(e));
    }
  }

  async function saveQrisSettings(basePayload, imageUrl) {
    const nextQris = {
      ...(settings?.qris && typeof settings.qris === "object" ? settings.qris : {}),
      base_payload: String(basePayload || "").trim(),
      image_url: String(imageUrl || "").trim(),
    };
    const tid = toast.loading("Simpan QRIS…");

    try {
      await upsertSetting("qris", nextQris);
      const nextSettings = await fetchSettings();
      setSettings(nextSettings);
      toast.remove(tid);
      toast.success("QRIS disimpan", { duration: 1200 });
    } catch (e) {
      toast.remove(tid);
      toast.error("Gagal simpan QRIS");
      setMsg(e?.message || String(e));
    }
  }

  // ===== Render =====
  const tabs = [
    { id: "overview", label: "Ringkasan", hint: "Kondisi toko hari ini" },
    { id: "products", label: "Produk", hint: "Katalog dan paket aktif" },
    { id: "orders", label: "Pesanan", hint: "Antrean dan tindak lanjut" },
    { id: "promos", label: "Promo", hint: "Kode diskon dan penggunaan" },
    { id: "testimonials", label: "Testimoni", hint: "Bukti pelanggan yang tayang" },
    { id: "settings", label: "Pengaturan", hint: "WA, QRIS, dan operasional" },
  ];

  const activeTab = tabs.find((item) => item.id === tab) || tabs[0];
  const ActiveTabIcon = TAB_ICONS[activeTab.id] || Box;
  const tabMeta = {
    overview: `${analyticsSummary.todayOrders} hari ini`,
    products: `${products.length} produk`,
    orders: `${orderStats.live} aktif`,
    promos: `${analyticsSummary.activePromos} aktif`,
    testimonials: `${analyticsSummary.activeTestimonials} tayang`,
    settings: normalizeWhatsApp(settingsWhatsApp || waNumber) ? "WA siap" : "WA kosong",
  };
  const syncCopy = loading
    ? "Menyelaraskan data..."
    : lastSyncedAt
      ? `Terakhir sinkron ${formatAdminDate(lastSyncedAt)}`
      : activeTab.hint;

  return (
    <div className="page admin-page">
      <section className="section">
        <div className="container admin-shell">
          <aside className="admin-sidebar">
            <div className="admin-brand">
              <div className="admin-logo">IM</div>
              <div>
                <div className="admin-brand-title">Ruang Admin</div>
                <div className="admin-brand-sub">operasional imzaqi.store</div>
              </div>
            </div>

            <div className="admin-sidebarPulseGrid">
              <div className="admin-sidebarPulse">
                <span>Hari ini</span>
                <strong>{analyticsSummary.todayOrders}</strong>
                <small>order masuk</small>
              </div>
              <div className="admin-sidebarPulse">
                <span>Omzet</span>
                <strong>{formatCompactIDR(analyticsSummary.todayRevenue)}</strong>
                <small>update harian</small>
              </div>
            </div>

            <nav className="admin-nav">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  className={"admin-nav-btn " + (tab === t.id ? "active" : "")}
                  onClick={() => startTransition(() => setTab(t.id))}
                >
                  <span className="admin-nav-icon">
                    {React.createElement(TAB_ICONS[t.id] || Box, { size: 16 })}
                  </span>
                  <span className="admin-nav-copy">
                    <strong>{t.label}</strong>
                    <small>{t.hint}</small>
                  </span>
                  <span className="admin-nav-badge">{tabMeta[t.id]}</span>
                </button>
              ))}
            </nav>

            <div className="admin-sidebar-actions">
              <button className="btn btn-ghost" type="button" onClick={refreshAll}>
                Muat ulang
              </button>
              <button className="btn btn-danger" type="button" onClick={logout}>
                Keluar
              </button>
            </div>
          </aside>

          <main className="admin-main">
            <div className="admin-mobileControls">
              <div className="admin-mobileBar">
                <div className="admin-mobileBrand">
                  <div className="admin-logo">IM</div>
                  <div className="admin-mobileCopy">
                    <strong>Ruang Admin</strong>
                    <span>{syncCopy}</span>
                  </div>
                </div>

                <div className="admin-mobileActions">
                  <button className="btn btn-ghost btn-sm" type="button" onClick={refreshAll}>
                    Muat ulang
                  </button>
                  <button className="btn btn-danger btn-sm" type="button" onClick={logout}>
                    Keluar
                  </button>
                </div>
              </div>

              <nav className="admin-mobileTabs" aria-label="Navigasi admin mobile">
                {tabs.map((t) => {
                  const MobileTabIcon = TAB_ICONS[t.id] || Box;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={`admin-mobileTab ${tab === t.id ? "active" : ""}`}
                      onClick={() => startTransition(() => setTab(t.id))}
                    >
                      <span className="admin-mobileTabIcon">
                        <MobileTabIcon size={15} />
                      </span>
                      <span className="admin-mobileTabLabel">{t.label}</span>
                      <span className="admin-mobileTabMeta">{tabMeta[t.id]}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="admin-topbar">
              <div className="admin-topbarCopy">
                <div className="admin-topbar-eyebrow">{activeTab.label}</div>
                <h1 className="h2">Operasional toko</h1>
                <div className="muted">Pilih area kerja di kiri. Setiap panel diringkas supaya cepat dipindai saat toko lagi ramai.</div>
              </div>

              <div className="admin-topbar-current">
                <span className="admin-topbar-currentIcon">
                  <ActiveTabIcon size={16} />
                </span>
                <div>
                  <strong>{activeTab.label}</strong>
                  <span>{syncCopy}</span>
                </div>
              </div>
            </div>

            <FlowAssist
              eyebrow="Konteks kerja"
              title={`Fokus: ${activeTab.label}.`}
              description="Ringkasan inti tetap dekat."
              badges={[
                { label: tabMeta[activeTab.id], tone: "emphasis", icon: <ActiveTabIcon size={13} /> },
                `${orderStats.live} order aktif`,
                `${analyticsSummary.stockAlerts.length} stok menipis`,
                testimonialsWithoutCaption ? `${testimonialsWithoutCaption} testimoni polos` : "Testimoni rapi",
              ]}
              actions={[
                tab !== "orders"
                  ? {
                      label: "Buka pesanan",
                      onClick: () => startTransition(() => setTab("orders")),
                      icon: <ClipboardList size={14} />,
                    }
                  : null,
                tab !== "products"
                  ? {
                      label: "Cek produk",
                      onClick: () => startTransition(() => setTab("products")),
                      ghost: true,
                      icon: <Box size={14} />,
                    }
                  : null,
                tab !== "testimonials" && testimonialsWithoutCaption
                  ? {
                      label: "Rapikan testimoni",
                      onClick: () => startTransition(() => setTab("testimonials")),
                      ghost: true,
                      icon: <Star size={14} />,
                    }
                  : null,
                { label: "Muat ulang", onClick: refreshAll, ghost: true, icon: <Eye size={14} /> },
              ].filter(Boolean)}
              className="admin-flowAssist"
              dense
            />

            <div className="admin-stats">
              {dashboardStats.map((stat) => {
                const StatIcon = stat.icon || TAB_ICONS[stat.key] || Box;
                return (
                  <div key={stat.key} className="admin-statCard">
                    <span className="admin-statIcon">
                      <StatIcon size={16} />
                    </span>
                    <span className="admin-statLabel">{stat.label}</span>
                    <strong className="admin-statValue">{stat.value}</strong>
                    <span className="admin-statHelper">{stat.helper}</span>
                  </div>
                );
              })}
            </div>

            {msg ? (
              <div className="admin-alert">
                <b>Info:</b> {msg}
              </div>
            ) : null}

            {tab === "overview" ? (
              <div className="admin-overview">
                <div className="admin-panel admin-overviewHero">
                  <div className="admin-panel-body">
                    <div className="admin-overviewHeroTop">
                      <div>
                        <div className="admin-topbar-eyebrow">Ringkasan hari ini</div>
                        <div className="admin-heroTitle">Satu layar untuk membaca kondisi toko hari ini.</div>
                        <div className="admin-panel-sub">
                          Revenue, order masuk, stok tipis, dan performa promo dibungkus jadi ringkasan yang cepat dipahami.
                        </div>
                      </div>

                      <div className="admin-chipRow">
                        {ANALYTICS_WINDOWS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className={`admin-chip ${analyticsWindow === option.value ? "active" : ""}`}
                            onClick={() => setAnalyticsWindow(option.value)}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="admin-miniGrid admin-miniGridHero">
                      <div className="admin-miniCard">
                        <span>Revenue total</span>
                        <strong>{formatCompactIDR(analyticsSummary.revenueTotal)}</strong>
                        <small>{analyticsSummary.doneOrders} order sukses</small>
                      </div>
                      <div className="admin-miniCard">
                        <span>Revenue hari ini</span>
                        <strong>{formatCompactIDR(analyticsSummary.todayRevenue)}</strong>
                        <small>{analyticsSummary.todayOrders} order masuk</small>
                      </div>
                      <div className="admin-miniCard">
                        <span>Rata-rata order</span>
                        <strong>{formatCompactIDR(analyticsSummary.averageOrderValue)}</strong>
                        <small>Nilai order selesai</small>
                      </div>
                      <div className="admin-miniCard">
                        <span>Konversi kasar</span>
                        <strong>{formatPercent(analyticsSummary.conversionRatio, 1)}</strong>
                        <small>{formatCompactNumber(storePulse.total_views)} total views</small>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="admin-overviewGrid">
                  <div className="admin-panel admin-panelWide">
                    <div className="admin-panel-head">
                      <div>
                        <div className="admin-panel-title">Tren order dan revenue</div>
                        <div className="admin-panel-sub">Order masuk dan revenue selesai per hari untuk membaca ritme toko.</div>
                      </div>
                    </div>

                    <div className="admin-panel-body">
                      <div className="admin-chartList">
                        {analyticsSummary.trend.map((point) => (
                          <div key={point.key} className="admin-chartRow">
                            <div className="admin-chartLabel">
                              <strong>{point.label}</strong>
                              <small>{point.orders} order</small>
                            </div>
                            <div className="admin-chartBars">
                              <div className="admin-chartTrack">
                                <span
                                  className="admin-chartBar orders"
                                  style={{ width: `${clampPercent((point.orders / analyticsSummary.maxOrders) * 100)}%` }}
                                />
                              </div>
                              <div className="admin-chartTrack">
                                <span
                                  className="admin-chartBar revenue"
                                  style={{ width: `${clampPercent((point.revenue / analyticsSummary.maxRevenue) * 100)}%` }}
                                />
                              </div>
                            </div>
                            <div className="admin-chartValue">
                              <strong>{formatCompactIDR(point.revenue)}</strong>
                              <small>Revenue</small>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="admin-panel">
                    <div className="admin-panel-head">
                      <div>
                        <div className="admin-panel-title">Status order</div>
                        <div className="admin-panel-sub">Baca distribusi antrean untuk melihat prioritas follow-up.</div>
                      </div>
                    </div>
                    <div className="admin-panel-body admin-stack">
                      {ORDER_STATUS_OPTIONS.map((option) => {
                        const count = analyticsSummary.statusMap[option.value] || 0;
                        const ratio = orders.length ? (count / orders.length) * 100 : 0;
                        return (
                          <div key={option.value} className="admin-statusMetric">
                            <div className="admin-statusMetricTop">
                              <span>{option.label}</span>
                              <strong>{count}</strong>
                            </div>
                            <div className="admin-progress">
                              <span style={{ width: `${clampPercent(ratio)}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="admin-panel">
                    <div className="admin-panel-head">
                      <div>
                        <div className="admin-panel-title">Produk paling laku</div>
                        <div className="admin-panel-sub">Dibaca dari item dalam order yang masuk.</div>
                      </div>
                    </div>
                    <div className="admin-panel-body admin-stack">
                      {analyticsSummary.topProducts.length ? (
                        analyticsSummary.topProducts.map((item, index) => (
                          <div key={item.name} className="admin-rankItem">
                            <div className="admin-rankIndex">#{index + 1}</div>
                            <div className="admin-rankCopy">
                              <strong>{item.name}</strong>
                              <small>{item.quantity} item terjual</small>
                            </div>
                            <div className="admin-rankMeta">{formatCompactIDR(item.revenue)}</div>
                          </div>
                        ))
                      ) : (
                        <div className="admin-emptyInline">Belum ada cukup data penjualan untuk dirangkum.</div>
                      )}
                    </div>
                  </div>

                  <div className="admin-panel">
                    <div className="admin-panel-head">
                      <div>
                        <div className="admin-panel-title">Promo dan kategori</div>
                        <div className="admin-panel-sub">Gabungkan insight kategori, promo aktif, dan klaim promo.</div>
                      </div>
                    </div>
                    <div className="admin-panel-body admin-stack">
                      <div className="admin-miniGrid">
                        <div className="admin-miniCard">
                          <span>Promo aktif</span>
                          <strong>{analyticsSummary.activePromos}</strong>
                          <small>{promoClaims.length} total claim</small>
                        </div>
                        <div className="admin-miniCard">
                          <span>Produk aktif</span>
                          <strong>{analyticsSummary.activeProducts}</strong>
                          <small>{analyticsSummary.inactiveProducts} nonaktif</small>
                        </div>
                      </div>

                      {analyticsSummary.categories.length ? (
                        analyticsSummary.categories.map((item) => (
                          <div key={item.category} className="admin-rankItem compact">
                            <div className="admin-rankCopy">
                              <strong>{item.category}</strong>
                              <small>{item.quantity} item</small>
                            </div>
                            <div className="admin-rankMeta">{formatCompactIDR(item.revenue)}</div>
                          </div>
                        ))
                      ) : null}

                      {analyticsSummary.promoUsage.length ? (
                        analyticsSummary.promoUsage.map((item) => (
                          <div key={item.code} className="admin-rankItem compact">
                            <div className="admin-rankCopy">
                              <strong>{item.code}</strong>
                              <small>{item.orders} order memakai promo ini</small>
                            </div>
                            <div className="admin-rankMeta">{formatCompactIDR(item.revenue)}</div>
                          </div>
                        ))
                      ) : (
                        <div className="admin-emptyInline">Belum ada promo yang dipakai dalam checkout.</div>
                      )}
                    </div>
                  </div>

                  <div className="admin-panel">
                    <div className="admin-panel-head">
                      <div>
                        <div className="admin-panel-title">Traffic dan stok</div>
                        <div className="admin-panel-sub">Hubungkan traffic halaman dengan kesiapan stok paket.</div>
                      </div>
                    </div>
                    <div className="admin-panel-body admin-stack">
                      <div className="admin-miniGrid">
                        <div className="admin-miniCard">
                          <span>Total views</span>
                          <strong>{formatCompactNumber(storePulse.total_views)}</strong>
                          <small>{formatCompactNumber(storePulse.today_views)} views hari ini</small>
                        </div>
                        <div className="admin-miniCard">
                          <span>Pipeline</span>
                          <strong>{formatCompactIDR(analyticsSummary.pipelineValue)}</strong>
                          <small>{orderStats.live} order butuh aksi</small>
                        </div>
                      </div>

                      {analyticsSummary.stockAlerts.length ? (
                        analyticsSummary.stockAlerts.map((variant) => (
                          <div key={variant.id} className="admin-alertItem">
                            <div>
                              <strong>{variant.name}</strong>
                              <small>{variant.duration_label || "Tanpa durasi"}</small>
                            </div>
                            <div className="admin-rankMeta">Sisa {variant.stock}</div>
                          </div>
                        ))
                      ) : (
                        <div className="admin-emptyInline">Belum ada stok kritis. Kondisi katalog cukup aman.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {tab === "products" ? (
              <div className="admin-products">
                <div className="admin-panel">
                  <div className="admin-panel-head">
                    <div>
                      <div className="admin-panel-title">Daftar produk</div>
                      <div className="admin-panel-sub">Cari produk, cek status aktif, lalu edit paketnya dari panel sebelah.</div>
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

                    <div className="admin-miniGrid" style={{ marginTop: 14, marginBottom: 14 }}>
                      <div className="admin-miniCard">
                        <span>Total produk</span>
                        <strong>{products.length}</strong>
                        <small>{analyticsSummary.activeProducts} aktif</small>
                      </div>
                      <div className="admin-miniCard">
                        <span>Total varian</span>
                        <strong>{allVariants.length}</strong>
                        <small>{analyticsSummary.stockAlerts.length} stok tipis</small>
                      </div>
                    </div>

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
                              <div className="admin-categoryTag">{prettyCategory(p.category)}</div>
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

                          <label className="admin-field">
                            <span>Kategori</span>
                            <select
                              className="input"
                              value={productForm.category}
                              onChange={(e) => setProductForm((p) => ({ ...p, category: e.target.value }))}
                            >
                              {CATEGORY_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
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
                                category: selectedProduct.category || "other",
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
              <div className="admin-ordersLayout">
                <div className="admin-panel">
                  <div className="admin-panel-head">
                    <div>
                      <div className="admin-panel-title">Queue order</div>
                      <div className="admin-panel-sub">Antrean order dibuat lebih cepat dibaca, dicari, dan di-follow-up dari layar kecil maupun besar.</div>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={refreshOrders}>
                      Refresh orders
                    </button>
                  </div>

                  <div className="admin-panel-body">
                    <div className="admin-orderToolbar">
                      <div className="admin-searchRow">
                        <Search size={16} />
                        <input
                          className="input admin-searchInput"
                          value={orderQuery}
                          onChange={(e) => setOrderQuery(e.target.value)}
                          placeholder="Cari kode, WA, promo, atau nama produk..."
                        />
                      </div>

                      <div className="admin-chipRow">
                        <button type="button" className={`admin-chip ${orderBucket === "all" ? "active" : ""}`} onClick={() => setOrderBucket("all")}>
                          Semua
                        </button>
                        <button
                          type="button"
                          className={`admin-chip ${orderBucket === "attention" ? "active" : ""}`}
                          onClick={() => setOrderBucket("attention")}
                        >
                          Butuh aksi
                        </button>
                        <button type="button" className={`admin-chip ${orderBucket === "done" ? "active" : ""}`} onClick={() => setOrderBucket("done")}>
                          Selesai
                        </button>
                        <button
                          type="button"
                          className={`admin-chip ${orderBucket === "cancelled" ? "active" : ""}`}
                          onClick={() => setOrderBucket("cancelled")}
                        >
                          Batal
                        </button>
                      </div>
                    </div>

                    <div className="admin-miniGrid" style={{ marginTop: 14 }}>
                      <div className="admin-miniCard">
                        <span>Total order</span>
                        <strong>{orderStats.total}</strong>
                        <small>Semua status</small>
                      </div>
                      <div className="admin-miniCard">
                        <span>Perlu aksi</span>
                        <strong>{orderStats.live}</strong>
                        <small>{formatCompactIDR(analyticsSummary.pipelineValue)}</small>
                      </div>
                      <div className="admin-miniCard">
                        <span>Selesai</span>
                        <strong>{orderStats.done}</strong>
                        <small>{formatCompactIDR(analyticsSummary.revenueTotal)}</small>
                      </div>
                      <div className="admin-miniCard">
                        <span>Dibatalkan</span>
                        <strong>{orderStats.cancelled}</strong>
                        <small>Perlu review bila naik</small>
                      </div>
                    </div>

                    {filteredOrders.length === 0 ? (
                      <div className="card pad" style={{ marginTop: 16 }}>
                        <EmptyState icon="ORD" title="Order tidak ditemukan" description="Coba ubah filter atau kata kunci pencarian." />
                      </div>
                    ) : (
                      <div className="admin-ordersFeed" style={{ marginTop: 16 }}>
                        {filteredOrders.map((o) => {
                          const itemCount = getOrderItemCount(o);
                          const discountAmount = getOrderDiscountAmount(o);
                          const isOpen = expandedOrderId === o.id;
                          const whatsappLink = buildWhatsAppLink(o.customer_whatsapp);

                          return (
                            <article key={o.id} className={`admin-orderCardModern ${isOpen ? "open" : ""}`}>
                              <button
                                type="button"
                                className="admin-orderSummary"
                                onClick={() => setExpandedOrderId((prev) => (prev === o.id ? "" : o.id))}
                              >
                                <div className="admin-orderSummaryMain">
                                  <div className="admin-order-code">{o.order_code || o.id}</div>
                                  <div className="admin-order-sub">
                                    {formatAdminDate(o.created_at)} • {itemCount} item • {o.customer_whatsapp || "Tanpa WA"}
                                  </div>
                                </div>

                                <div className="admin-orderSummarySide">
                                  <StatusBadge status={o.status} />
                                  <strong>{formatIDR(o.total_idr)}</strong>
                                  <span className="admin-chevron">{isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
                                </div>
                              </button>

                              {isOpen ? (
                                <div className="admin-orderBodyModern">
                                  <div className="admin-orderMetaGrid">
                                    <div className="admin-orderMetaCard">
                                      <span>Kontak customer</span>
                                      <strong>{o.customer_whatsapp || "-"}</strong>
                                      {whatsappLink ? (
                                        <a href={whatsappLink} target="_blank" rel="noreferrer">
                                          Chat WhatsApp
                                        </a>
                                      ) : (
                                        <small>Tidak ada nomor WA</small>
                                      )}
                                    </div>
                                    <div className="admin-orderMetaCard">
                                      <span>Status sekarang</span>
                                      <strong>{prettyStatus(o.status)}</strong>
                                      <small>{o.promo_code ? `Promo ${o.promo_code}` : "Tanpa promo"}</small>
                                    </div>
                                    <div className="admin-orderMetaCard">
                                      <span>Update status</span>
                                      <select
                                        className="input admin-select"
                                        value={String(o.status || "pending")}
                                        onChange={(e) => updateOrderStatus(o.id, e.target.value)}
                                      >
                                        {ORDER_STATUS_OPTIONS.map((option) => (
                                          <option key={option.value} value={option.value}>
                                            {option.label}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>

                                  <div className="admin-order-items">
                                    {getSafeOrderItems(o).map((it, idx) => (
                                      <div key={`${o.id}-${idx}`} className="admin-order-item">
                                        <div>
                                          <b>{it.product_name}</b>
                                          <div className="muted" style={{ fontSize: 12 }}>
                                            {it.variant_name} • {it.duration_label}
                                          </div>
                                        </div>
                                        <div className="admin-order-itemPrice">
                                          <strong>{it.qty}x</strong>
                                          <span>{formatIDR(it.price_idr)}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>

                                  <div className="admin-order-pricing">
                                    <div className="admin-order-priceRow">
                                      <span>Subtotal</span>
                                      <b>{formatIDR(o.subtotal_idr)}</b>
                                    </div>
                                    <div className="admin-order-priceRow">
                                      <span>Diskon {o.discount_percent ? `(${o.discount_percent}%)` : ""}</span>
                                      <b>- {formatIDR(discountAmount)}</b>
                                    </div>
                                    <div className="admin-order-priceRow total">
                                      <span>Total bayar</span>
                                      <b>{formatIDR(o.total_idr)}</b>
                                    </div>
                                  </div>

                                  <div className={"admin-order-notes" + (o.notes ? "" : " empty")}>
                                    <div className="admin-order-notesTitle">Catatan customer</div>
                                    <div>{o.notes || "Tidak ada catatan tambahan."}</div>
                                  </div>

                                  <div className="admin-order-adminNote">
                                    <div className="admin-order-notesTitle">Catatan admin</div>
                                    <textarea
                                      className="input admin-textarea"
                                      rows={3}
                                      value={adminNoteDrafts[o.id] || ""}
                                      onChange={(e) => setAdminNoteDrafts((prev) => ({ ...prev, [o.id]: e.target.value }))}
                                      placeholder="Tulis instruksi internal atau bahan follow-up."
                                    />
                                    <div className="admin-order-adminActions">
                                      <button className="btn btn-sm" type="button" onClick={() => saveOrderAdminNote(o.id)}>
                                        Simpan catatan
                                      </button>
                                      {o.payment_proof_url ? (
                                        <a className="admin-proof" href={o.payment_proof_url} target="_blank" rel="noreferrer">
                                          Lihat bukti bayar
                                        </a>
                                      ) : (
                                        <span className="muted" style={{ fontSize: 13 }}>
                                          Tanpa bukti bayar
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ) : null}
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="admin-panel admin-sidePanel">
                  <div className="admin-panel-head">
                    <div>
                      <div className="admin-panel-title">Focus panel</div>
                      <div className="admin-panel-sub">Ringkasan cepat order yang sedang dibuka dan antrean aktif hari ini.</div>
                    </div>
                  </div>
                  <div className="admin-panel-body admin-stack">
                    {expandedOrder ? (
                      <>
                        <div className="admin-miniGrid">
                          <div className="admin-miniCard">
                            <span>Order aktif</span>
                            <strong>{expandedOrder.order_code || expandedOrder.id}</strong>
                            <small>{prettyStatus(expandedOrder.status)}</small>
                          </div>
                          <div className="admin-miniCard">
                            <span>Total</span>
                            <strong>{formatCompactIDR(expandedOrder.total_idr)}</strong>
                            <small>{getOrderItemCount(expandedOrder)} item</small>
                          </div>
                        </div>

                        <div className="admin-focusList">
                          <div className="admin-focusRow">
                            <span>Masuk</span>
                            <strong>{formatAdminDate(expandedOrder.created_at)}</strong>
                          </div>
                          <div className="admin-focusRow">
                            <span>Promo</span>
                            <strong>{expandedOrder.promo_code || "-"}</strong>
                          </div>
                          <div className="admin-focusRow">
                            <span>WhatsApp</span>
                            <strong>{expandedOrder.customer_whatsapp || "-"}</strong>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="admin-emptyInline">Buka salah satu order untuk melihat detail cepat di panel ini.</div>
                    )}

                    <div className="admin-miniGrid">
                      <div className="admin-miniCard">
                        <span>Order hari ini</span>
                        <strong>{analyticsSummary.todayOrders}</strong>
                        <small>{formatCompactIDR(analyticsSummary.todayRevenue)}</small>
                      </div>
                      <div className="admin-miniCard">
                        <span>Pending + proses</span>
                        <strong>{orderStats.live}</strong>
                        <small>Antrian aktif sekarang</small>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {false ? (
              <div className="admin-panel">
                <div className="admin-panel-head">
                  <div>
                    <div className="admin-panel-title">Orders</div>
                    <div className="admin-panel-sub">Pantau pesanan, cek bukti bayar, lihat catatan customer, dan ubah status.</div>
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
                      {orders.map((o) => {
                        const itemCount = getOrderItemCount(o);
                        const discountAmount = getOrderDiscountAmount(o);

                        return (
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

                            <div className="admin-order-pricing">
                              <div className="admin-order-priceRow">
                                <span>Jumlah item</span>
                                <b>{itemCount}</b>
                              </div>
                              <div className="admin-order-priceRow">
                                <span>Subtotal</span>
                                <b>{formatIDR(o.subtotal_idr)}</b>
                              </div>
                              <div className="admin-order-priceRow">
                                <span>Diskon {o.discount_percent ? `(${o.discount_percent}%)` : ""}</span>
                                <b>- {formatIDR(discountAmount)}</b>
                              </div>
                              <div className="admin-order-priceRow total">
                                <span>Total bayar</span>
                                <b>{formatIDR(o.total_idr)}</b>
                              </div>
                              {o.promo_code ? <div className="admin-order-promo">Promo terpakai: {o.promo_code}</div> : null}
                            </div>

                            <div className={"admin-order-notes" + (o.notes ? "" : " empty")}>
                              <div className="admin-order-notesTitle">Catatan customer</div>
                              <div>{o.notes || "Tidak ada catatan tambahan."}</div>
                            </div>

                            <div className="admin-order-adminNote">
                              <div className="admin-order-notesTitle">Catatan admin ke customer</div>
                              <textarea
                                className="input admin-textarea"
                                rows={3}
                                value={adminNoteDrafts[o.id] || ""}
                                onChange={(e) => setAdminNoteDrafts((prev) => ({ ...prev, [o.id]: e.target.value }))}
                                placeholder="Status tambahan, instruksi, atau info penting untuk customer."
                              />
                              <div className="admin-order-adminActions">
                                <button className="btn btn-sm" type="button" onClick={() => saveOrderAdminNote(o.id)}>
                                  Simpan Catatan
                                </button>
                              </div>
                            </div>

                            {o.payment_proof_url ? (
                              <a className="admin-proof" href={o.payment_proof_url} target="_blank" rel="noreferrer">
                                Lihat bukti bayar
                              </a>
                            ) : (
                              <div className="muted" style={{ fontSize: 13 }}>
                                Order ini dibuat tanpa upload bukti bayar.
                              </div>
                            )}
                          </div>
                          </div>
                        );
                      })}
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
              <div className="admin-overviewGrid">
                <div className="admin-panel admin-panelWide">
                  <div className="admin-panel-head">
                    <div>
                      <div className="admin-panel-title">Settings operasional</div>
                      <div className="admin-panel-sub">Area ini disederhanakan agar update nomor admin tetap nyaman dilakukan dari mobile.</div>
                    </div>
                  </div>

                  <div className="admin-panel-body">
                    <div className="admin-form-grid">
                      <label className="admin-field admin-field-full">
                        <span>WhatsApp Admin</span>
                        <input
                          className="input"
                          value={settingsWhatsApp}
                          placeholder="62813..."
                          onChange={(e) => setSettingsWhatsApp(e.target.value)}
                        />
                        <div className="hint subtle">Gunakan format angka agar tombol chat customer tetap konsisten.</div>
                      </label>

                      <label className="admin-field admin-field-full">
                        <span>QRIS Base Payload</span>
                        <textarea
                          className="input admin-textarea"
                          rows={4}
                          value={settingsQrisBase}
                          placeholder="000201..."
                          onChange={(e) => setSettingsQrisBase(e.target.value)}
                        />
                        <div className="hint subtle">Dipakai untuk generate QR dengan nominal otomatis.</div>
                      </label>

                      <label className="admin-field admin-field-full">
                        <span>Fallback QR Image URL</span>
                        <input
                          className="input"
                          value={settingsQrisImageUrl}
                          placeholder="https://..."
                          onChange={(e) => setSettingsQrisImageUrl(e.target.value)}
                        />
                        <div className="hint subtle">Opsional. Dipakai jika generator QR otomatis gagal.</div>
                      </label>
                    </div>

                    <div className="admin-form-actions">
                      <button className="btn" type="button" onClick={() => saveWhatsApp(settingsWhatsApp)}>
                        Simpan WhatsApp
                      </button>
                      <button className="btn btn-ghost" type="button" onClick={() => saveQrisSettings(settingsQrisBase, settingsQrisImageUrl)}>
                        Simpan QRIS
                      </button>
                    </div>
                  </div>
                </div>

                <div className="admin-panel">
                  <div className="admin-panel-head">
                    <div>
                      <div className="admin-panel-title">Catatan sistem</div>
                      <div className="admin-panel-sub">Info singkat yang sering dibutuhkan saat operasional.</div>
                    </div>
                  </div>

                  <div className="admin-panel-body admin-stack">
                    <div className="admin-miniCard">
                      <span>Last sync</span>
                      <strong>{lastSyncedAt ? formatAdminDate(lastSyncedAt) : "-"}</strong>
                      <small>Refresh manual bila data belum terbaru</small>
                    </div>
                    <div className="admin-miniCard">
                      <span>QRIS</span>
                      <strong>{qrisModeLabel}</strong>
                      <small>{qrisModeCopy}</small>
                    </div>
                    <div className="admin-miniCard">
                      <span>Traffic hari ini</span>
                      <strong>{formatCompactNumber(storePulse.today_views)} views</strong>
                      <small>{storePulse.today_orders || analyticsSummary.todayOrders} order masuk</small>
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

          <label className="admin-field">
            <span>Kategori</span>
            <select
              className="input"
              value={newProduct.category}
              onChange={(e) => setNewProduct((p) => ({ ...p, category: e.target.value }))}
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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
