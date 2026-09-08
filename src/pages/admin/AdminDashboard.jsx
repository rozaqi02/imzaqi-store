import React, {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Box,
  Check,
  ClipboardList,
  Copy,
  Eye,
  Filter,
  LayoutDashboard,
  MapPin,
  Pencil,
  Plus,
  Search,
  Settings2,
  Star,
  Tags,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";

import Modal from "../../components/Modal";
import ConfirmDialog from "../../components/ConfirmDialog";
import EmptyState from "../../components/EmptyState";
import FlowAssist from "../../components/FlowAssist";
import { checkAdminAccess } from "../../lib/adminAuth";
import {
  ORDER_STATUS_OPTIONS,
  LIVE_ORDER_STATUSES,
  prettyOrderStatus,
} from "../../lib/orderStatus";
import { AdminSidebar, AdminMobileNav } from "./components/AdminNav";
import VirtualList from "./components/VirtualList";
import AdminOrderListItem from "./components/AdminOrderListItem";
import {
  ADMIN_PRODUCTS_CACHE_TTL_MS,
  EMPTY_ANALYTICS_SUMMARY,
  ORDERS_PAGE_SIZE,
  ORDER_SELECT_DETAIL,
  ORDER_SELECT_LIST,
  ORDER_SELECT_LIST_FALLBACK,
  REALTIME_TOAST_DEBOUNCE_MS,
  STOCK_THIN_BELOW,
  isThinStock,
  statusFilterForBucket,
} from "./adminPerf";
import "../../css/pages/AdminDashboard.css";
import "../../css/pages/AdminDashboard.light.css";
import "../../css/pages/AdminDashboard.fixes.css";
import "../../css/pages/AdminNav.css";
import "../../css/pages/AdminUI.overhaul.css";
import "../../css/pages/AdminApp.shell.css";

import { supabase } from "../../lib/supabaseClient";
import {
  fetchProducts,
  invalidateProductCaches,
  fetchPromoCodes,
  fetchSettings,
  fetchTestimonials,
  upsertSetting,
  fetchDailyStats,
  fetchVisitorStats,
  fetchTopPages,
  fetchCohortReturn,
  buildOrdersCSV,
  downloadCSV,
  fetchAllFlashSales,
  createFlashSale,
  updateFlashSale,
  deleteFlashSale,
  invalidateTestimonialsCache,
} from "../../lib/api";
import { formatIDR, slugify, getTimeline, calcConversionRate, formatCohortDisplay, calcRevenueForecast, isPromoExpired } from "../../lib/format";
import { usePageMeta } from "../../hooks/usePageMeta";
import { useToast } from "../../context/ToastContext";
import { copyToClipboard } from "../../utils/clipboard";
import { warn } from "../../lib/log";
import {
  notifyAdminNewOrder,
  requestAdminNotificationPermission,
  buildAdminOrderAlertUrl,
} from "../../lib/adminNotify";

import {
  CATEGORY_OPTIONS,
  StatusBadge,
  buildWhatsAppLink,
  formatAdminDate,
  formatAdminDateTime,
  formatCompactNumber,
  formatDayLabel,
  formatPercent,
  getOrderDiscountAmount,
  getOrderItemCount,
  getSafeOrderItems,
  normalizeWhatsApp,
  prettyCategory,
  toDateKeyWIB,
} from "./adminUtils";

function toLocalDatetimeInput(dateValue) {
  if (!dateValue) return "";
  const d = new Date(dateValue);
  if (isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

const BUCKET_ICONS = "product-icons"; // public
const BUCKET_TESTIMONIALS = "testimonials"; // public
const ANALYTICS_WINDOWS = [
  { value: "7d", label: "7 hari" },
  { value: "30d", label: "30 hari" },
];
const TAB_ICONS = {
  overview: LayoutDashboard,
  products: Box,
  orders: ClipboardList,
  promos: Tags,
  flashsale: TrendingUp,
  testimonials: Star,
  settings: Settings2,
};

/** Tabs that need products in memory (stock / variants / category map). */
const TABS_NEED_PRODUCTS = new Set(["overview", "products", "flashsale", "orders"]);
/** Tabs that need orders list. */
const TABS_NEED_ORDERS = new Set(["overview", "orders"]);

function clampPercent(value) {
  return Math.max(0, Math.min(100, Number(value || 0)));
}

export default function AdminDashboard() {
  const nav = useNavigate();
  const toast = useToast();

  usePageMeta({
    title: "Admin Dashboard",
    description: "Kelola produk, varian, promo, testimoni, sama pesanan.",
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
  const [flashSales, setFlashSales] = useState([]);
  const [flashForm, setFlashForm] = useState({ variant_id: "", discount_percent: "", starts_at: "", ends_at: "" });
  const [flashFormOpen, setFlashFormOpen] = useState(false);
  const [settings, setSettings] = useState({});
  const [storePulse, setStorePulse] = useState({
    total_views: 0,
    today_views: 0,
    total_orders: 0,
    today_orders: 0,
  });
  const [analyticsWindow, setAnalyticsWindow] = useState("7d");

  // ── Analytics state (dari tabel daily_stats & page_views) ──
  const [dailyStats, setDailyStats] = useState([]);
  const [visitorStats, setVisitorStats] = useState({ totalVisitors: 0, returningVisitors: 0, newVisitors: 0 });
  const [topPages, setTopPages] = useState([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [cohortReturn, setCohortReturn] = useState(0);
  const [funnelSummary, setFunnelSummary] = useState({ days: 7, steps: [] });
  const [restockRequests, setRestockRequests] = useState([]);

  // ── Bulk Actions state ──
  const [selectedOrderIds, setSelectedOrderIds] = useState(new Set());

  // Products UI state
  const [visibleProductsCount, setVisibleProductsCount] = useState(20);
  const [productQuery, setProductQuery] = useState("");
  /** all | low — low = only products with thin stock variants */
  const [productStockFilter, setProductStockFilter] = useState("all");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [productForm, setProductForm] = useState(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [orderQuery, setOrderQuery] = useState("");
  /** Status bucket: all | attention | done | cancelled */
  const [orderBucket, setOrderBucket] = useState("all");
  /** Catalog line: all | app_premium | academic */
  const [orderCatalogFilter, setOrderCatalogFilter] = useState("all");
  const [orderStatusFilterOpen, setOrderStatusFilterOpen] = useState(false);
  const [orderToolsOpen, setOrderToolsOpen] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState("");

  // Product modal
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: "",
    category: "other",
    description: "",
    icon_url: "",
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
    guarantee_text: "All full garansi",
    stock: 10,
    is_active: true,
    requires_buyer_email: false,
    sort_order: 100,
  });

  const [promoBulk, setPromoBulk] = useState("");
  // Promo form state
  const PROMO_FORM_EMPTY = { code: "", percent: "", expired_at: "", max_uses: "" };
  const [promoFormOpen, setPromoFormOpen] = useState(false);
  const [promoFormMode, setPromoFormMode] = useState("create"); // "create" | "edit"
  const [promoForm, setPromoForm] = useState(PROMO_FORM_EMPTY);
  const [promoQuery, setPromoQuery] = useState("");
  const [copiedCode, setCopiedCode] = useState("");
  const [promoDeleteTarget, setPromoDeleteTarget] = useState(null); // code string to confirm delete
  const [settingsWhatsApp, setSettingsWhatsApp] = useState("");
  const [settingsQrisBase, setSettingsQrisBase] = useState("");
  const [settingsQrisImageUrl, setSettingsQrisImageUrl] = useState("");
  const [settingsAcademicPopupEnabled, setSettingsAcademicPopupEnabled] = useState(false);
  const [newOrderCount, setNewOrderCount] = useState(0);
  const [exportDateFrom, setExportDateFrom] = useState("");
  const [exportDateTo, setExportDateTo] = useState("");
  const [ordersHasMore, setOrdersHasMore] = useState(false);
  const [ordersLoadingMore, setOrdersLoadingMore] = useState(false);
  /** Exact status totals from DB (not limited to current page). */
  const [orderDbStats, setOrderDbStats] = useState({
    total: 0,
    live: 0,
    done: 0,
    cancelled: 0,
    paidReported: 0,
    byStatus: {},
    loaded: false,
  });
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [msgIsError, setMsgIsError] = useState(false);
  /** Domain load flags — avoid re-fetch when switching tabs. */
  const loadedRef = useRef({
    settings: false,
    products: false,
    orders: false,
    analytics: false,
    promos: false,
    flashsale: false,
    testimonials: false,
    claims: false,
  });
  const ordersBucketRef = useRef(orderBucket);
  const realtimeToastAtRef = useRef(0);
  const ordersRef = useRef(orders);
  ordersRef.current = orders;
  const deferredProductQuery = useDeferredValue(productQuery);
  const deferredOrderQuery = useDeferredValue(orderQuery);
  const waNumber = settings?.whatsapp?.number || "";
  const savedQrisBase = String(settings?.qris?.base_payload || "").trim();
  const envQrisBase = String(import.meta.env.VITE_QRIS_BASE || "").trim();
  const qrisModeLabel = savedQrisBase || envQrisBase ? "Auto aktif" : "Fallback statis";
  const qrisModeCopy = savedQrisBase
    ? "Base QR tersimpan di database."
    : envQrisBase
      ? "Base QR masih ikut env build."
      : "Base QR kosong. Checkout akan pakai QR statis.";

  // ===== Auth guard + admin-only body class =====
  useEffect(() => {
    checkAdminAccess().then((result) => {
      if (!result.ok) {
        nav(result.reason === "not_admin" ? "/admin?error=not_admin" : "/admin");
        return;
      }
      setAdminEmail(String(result.user?.email || ""));
    });
  }, [nav]);

  useEffect(() => {
    document.body.classList.add("is-admin");
    return () => document.body.classList.remove("is-admin");
  }, []);

  function openConfirm({
    title,
    message,
    confirmLabel,
    danger,
    prompt = false,
    promptDefault = "",
    promptLabel = "Nilai",
    onConfirm,
  }) {
    setConfirmDialog({
      title,
      message,
      confirmLabel,
      danger,
      prompt,
      promptDefault,
      promptLabel,
      onConfirm: (value) => {
        setConfirmDialog(null);
        onConfirm(value);
      },
      onCancel: () => setConfirmDialog(null),
    });
  }

  function requestOrderStatusChange(orderId, nextStatus, currentStatus) {
    if (String(nextStatus) === String(currentStatus || "pending")) return;
    openConfirm({
      title: "Ubah status order",
      message: `Ubah status ke "${prettyOrderStatus(nextStatus)}"?`,
      confirmLabel: "Ya, ubah",
      danger: nextStatus === "cancelled",
      onConfirm: () => updateOrderStatus(orderId, nextStatus),
    });
  }

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

    const ac = settings?.academic_popup;
    if (ac && typeof ac === "object" && typeof ac.enabled === "boolean") {
      setSettingsAcademicPopupEnabled(ac.enabled);
    } else {
      setSettingsAcademicPopupEnabled(false);
    }
  }, [settings]);

  async function fetchOrdersPage(offset = 0, { bucket = orderBucket, detail = false } = {}) {
    const end = offset + ORDERS_PAGE_SIZE - 1;
    const selectFull = detail ? ORDER_SELECT_DETAIL : ORDER_SELECT_LIST;
    const selectFallback = ORDER_SELECT_LIST_FALLBACK;
    const statusFilter = statusFilterForBucket(bucket);

    const applyStatus = (q) => {
      if (!statusFilter) return q;
      if (statusFilter.type === "in") return q.in("status", statusFilter.values);
      return q.eq("status", statusFilter.value);
    };

    let query = applyStatus(
      supabase
        .from("orders")
        .select(selectFull)
        .order("created_at", { ascending: false })
        .range(offset, end)
    );
    let { data, error } = await query;

    if (error && /(notes|admin_note|payment_proof)/i.test(String(error?.message || ""))) {
      query = applyStatus(
        supabase
          .from("orders")
          .select(selectFallback)
          .order("created_at", { ascending: false })
          .range(offset, end)
      );
      ({ data, error } = await query);
    }

    if (error) throw error;
    const rows = data || [];
    return { rows, hasMore: rows.length === ORDERS_PAGE_SIZE };
  }

  async function fetchOrderDetail(orderId) {
    if (!orderId) return null;
    let { data, error } = await supabase
      .from("orders")
      .select(ORDER_SELECT_DETAIL)
      .eq("id", orderId)
      .maybeSingle();
    if (error && /(notes|admin_note|payment_proof)/i.test(String(error?.message || ""))) {
      ({ data, error } = await supabase
        .from("orders")
        .select(ORDER_SELECT_LIST_FALLBACK)
        .eq("id", orderId)
        .maybeSingle());
    }
    if (error) throw error;
    return data;
  }

  /** Full DB counts by status — independent of list page size. */
  async function fetchOrderDbStats() {
    try {
      const statuses = ORDER_STATUS_OPTIONS.map((o) => o.value);
      const pairs = await Promise.all(
        statuses.map(async (status) => {
          const { count, error } = await supabase
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("status", status);
          if (error) throw error;
          return [status, Number(count || 0)];
        })
      );
      const byStatus = Object.fromEntries(pairs);
      const total = pairs.reduce((sum, [, n]) => sum + n, 0);
      let live = 0;
      LIVE_ORDER_STATUSES.forEach((st) => {
        live += Number(byStatus[st] || 0);
      });
      const next = {
        total,
        live,
        done: Number(byStatus.done || 0),
        cancelled: Number(byStatus.cancelled || 0) + Number(byStatus.expired || 0),
        paidReported: Number(byStatus.paid_reported || 0),
        byStatus,
        loaded: true,
      };
      setOrderDbStats(next);
      return next;
    } catch (error) {
      warn("Gagal memuat orderDbStats", error);
      return null;
    }
  }

  async function fetchPromoClaimsData() {
    try {
      const { data, error } = await supabase
        .from("promo_claims")
        .select("id,visitor_id,code,claimed_at")
        .order("claimed_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      return data || [];
    } catch (error) {
      warn("Gagal memuat promo_claims", error);
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
      warn("Gagal memuat get_public_stats", error);
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
      warn("Gagal memuat site_stats", error);
    }

    return {
      total_views: 0,
      today_views: 0,
      total_orders: 0,
      today_orders: 0,
    };
  }

  async function loadOrdersAndPulse({ append = false, bucket = orderBucket } = {}) {
    const offset = append ? (ordersRef.current?.length || 0) : 0;
    const [{ rows, hasMore }, nextPulse] = await Promise.all([
      fetchOrdersPage(offset, { bucket }),
      fetchStorePulse(),
      // Refresh exact totals whenever orders list loads (not only first page)
      append ? Promise.resolve(null) : fetchOrderDbStats(),
    ]);
    setOrders((prev) => (append ? [...(prev || []), ...rows] : rows));
    setOrdersHasMore(hasMore);
    setStorePulse(nextPulse);
    setLastSyncedAt(new Date().toISOString());
    loadedRef.current.orders = true;
    ordersBucketRef.current = bucket;
    return append ? [...(ordersRef.current || []), ...rows] : rows;
  }

  async function loadMoreOrders() {
    if (ordersLoadingMore || !ordersHasMore) return;
    setOrdersLoadingMore(true);
    try {
      await loadOrdersAndPulse({ append: true, bucket: orderBucket });
      toast.success("Order lama dimuat", { duration: 1400 });
    } catch (e) {
      toast.error("Gagal memuat order lama");
      setMsg(e?.message || String(e));
      setMsgIsError(true);
    } finally {
      setOrdersLoadingMore(false);
    }
  }

  async function refreshProducts({ force = false } = {}) {
    const nextProducts = await fetchProducts({
      includeInactive: true,
      useCache: !force,
      ttlMs: ADMIN_PRODUCTS_CACHE_TTL_MS,
    });
    setProducts(nextProducts);
    loadedRef.current.products = true;
    return nextProducts;
  }

  async function refreshOrders({ force = false } = {}) {
    if (!force && loadedRef.current.orders && ordersBucketRef.current === orderBucket) {
      return ordersRef.current;
    }
    const [nextOrders, nextClaims] = await Promise.all([
      loadOrdersAndPulse({ append: false, bucket: orderBucket }),
      loadedRef.current.claims && !force
        ? Promise.resolve(promoClaims)
        : fetchPromoClaimsData().then((c) => {
            setPromoClaims(c);
            loadedRef.current.claims = true;
            return c;
          }),
    ]);
    return nextOrders;
  }

  async function refreshAnalytics(days, { force = false } = {}) {
    if (!force && loadedRef.current.analytics && analyticsWindow === (days === 30 ? "30d" : "7d")) {
      // Still allow window change via force from effect
    }
    setAnalyticsLoading(true);
    try {
      const [dailyResult, visitorResult, pagesResult, cohortResult, funnelResult] = await Promise.allSettled([
        fetchDailyStats({ days }),
        fetchVisitorStats({ days }),
        fetchTopPages({ days, limit: 10 }),
        fetchCohortReturn({ days: 7 }),
        supabase.rpc("get_funnel_summary", { p_days: days }),
      ]);

      if (dailyResult.status === "fulfilled") {
        setDailyStats(dailyResult.value);
      } else {
        warn("fetchDailyStats gagal:", dailyResult.reason);
      }

      if (visitorResult.status === "fulfilled") {
        setVisitorStats(visitorResult.value);
      } else {
        warn("fetchVisitorStats gagal:", visitorResult.reason);
      }

      if (pagesResult.status === "fulfilled") {
        setTopPages(pagesResult.value);
      } else {
        warn("fetchTopPages gagal:", pagesResult.reason);
      }

      if (cohortResult.status === "fulfilled") {
        setCohortReturn(cohortResult.value);
      } else {
        warn("fetchCohortReturn gagal:", cohortResult.reason);
      }
      if (funnelResult.status === "fulfilled" && !funnelResult.value?.error) {
        setFunnelSummary(funnelResult.value.data || { days, steps: [] });
      } else if (funnelResult.status === "rejected") {
        warn("get_funnel_summary gagal:", funnelResult.reason);
      }
      loadedRef.current.analytics = true;
    } catch (e) {
      warn("Gagal memuat analytics:", e);
    } finally {
      setAnalyticsLoading(false);
    }
  }

  /** Load only domains needed for a tab (lazy). */
  async function ensureTabData(tabId, { force = false } = {}) {
    const tasks = [];

    if (!loadedRef.current.settings || force) {
      tasks.push(
        fetchSettings({ useCache: !force, ttlMs: 30_000 }).then((s) => {
          setSettings(s);
          loadedRef.current.settings = true;
        })
      );
    }

    if (TABS_NEED_PRODUCTS.has(tabId) && (!loadedRef.current.products || force)) {
      tasks.push(refreshProducts({ force }));
    }

    if (TABS_NEED_ORDERS.has(tabId) && (!loadedRef.current.orders || force || ordersBucketRef.current !== orderBucket)) {
      tasks.push(refreshOrders({ force: force || ordersBucketRef.current !== orderBucket }));
    } else if (TABS_NEED_ORDERS.has(tabId) && !orderDbStats.loaded) {
      tasks.push(fetchOrderDbStats());
    }

    if (tabId === "overview" && (!loadedRef.current.analytics || force)) {
      const days = analyticsWindow === "30d" ? 30 : 7;
      tasks.push(refreshAnalytics(days, { force: true }));
      // Counts for KPI even if orders page already loaded
      if (!orderDbStats.loaded || force) tasks.push(fetchOrderDbStats());
      tasks.push(
        supabase.from("restock_requests")
          .select("id,customer_whatsapp,created_at,notified_at,product_id,variant_id,products(name),product_variants(name,duration_label)")
          .order("created_at", { ascending: false }).limit(30)
          .then(({ data, error }) => { if (!error) setRestockRequests(data || []); })
      );
    }

    if (tabId === "promos" && (!loadedRef.current.promos || force)) {
      tasks.push(
        fetchPromoCodes().then((pr) => {
          setPromos(pr);
          loadedRef.current.promos = true;
        })
      );
      if (!loadedRef.current.claims || force) {
        tasks.push(
          fetchPromoClaimsData().then((c) => {
            setPromoClaims(c);
            loadedRef.current.claims = true;
          })
        );
      }
    }

    if (tabId === "flashsale" && (!loadedRef.current.flashsale || force)) {
      tasks.push(
        fetchAllFlashSales()
          .catch(() => [])
          .then((fs) => {
            setFlashSales(fs);
            loadedRef.current.flashsale = true;
          })
      );
    }

    if (tabId === "testimonials" && (!loadedRef.current.testimonials || force)) {
      tasks.push(
        fetchTestimonials({ includeInactive: true, useCache: !force, ttlMs: ADMIN_PRODUCTS_CACHE_TTL_MS }).then((t) => {
          setTestimonials(t);
          loadedRef.current.testimonials = true;
        })
      );
    }

    if (tasks.length) {
      await Promise.all(tasks);
      setLastSyncedAt(new Date().toISOString());
    }
  }

  /** Manual full refresh (toolbar) — still scoped smarter than old refreshAll. */
  async function refreshAll() {
    setMsg("");
    setMsgIsError(false);
    const tid = toast.loading("Memuat dashboard");

    try {
      setLoading(true);
      // Invalidate domain flags so ensureTabData reloads active tab deeply
      loadedRef.current = {
        settings: false,
        products: false,
        orders: false,
        analytics: false,
        promos: false,
        flashsale: false,
        testimonials: false,
        claims: false,
      };
      invalidateProductCaches();
      await ensureTabData(tab, { force: true });
      // Always refresh pulse with orders when forced
      if (!TABS_NEED_ORDERS.has(tab)) {
        const pulse = await fetchStorePulse();
        setStorePulse(pulse);
      }
      toast.remove(tid);
      toast.success("Dashboard ter-update", { duration: 1600 });
    } catch (e) {
      toast.remove(tid);
      toast.error("Gagal memuat data admin");
      setMsg(e?.message || String(e));
      setMsgIsError(true);
    } finally {
      setLoading(false);
    }
  }

  // Bootstrap + lazy tab data (single effect — avoids double-fetch on mount)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const isCold = !loadedRef.current.settings && !lastSyncedAt;
      if (isCold) setLoading(true);
      try {
        await ensureTabData(tab);
      } catch (e) {
        if (!cancelled) {
          if (isCold) {
            toast.error("Gagal memuat data admin");
            setMsg(e?.message || String(e));
            setMsgIsError(true);
          } else {
            warn("ensureTabData:", e);
          }
        }
      } finally {
        if (!cancelled && isCold) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Server-side re-query when order status bucket changes (after first orders load)
  useEffect(() => {
    if (!loadedRef.current.orders) return;
    if (ordersBucketRef.current === orderBucket) return;
    let cancelled = false;
    (async () => {
      try {
        setOrdersLoadingMore(true);
        await loadOrdersAndPulse({ append: false, bucket: orderBucket });
      } catch (e) {
        if (!cancelled) {
          toast.error("Gagal filter order");
          warn(e);
        }
      } finally {
        if (!cancelled) setOrdersLoadingMore(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderBucket]);

  // Analytics window: only while on overview
  useEffect(() => {
    if (tab !== "overview") return;
    const days = analyticsWindow === "30d" ? 30 : 7;
    refreshAnalytics(days, { force: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyticsWindow, tab]);

  // Hydrate order detail fields when opening a row
  useEffect(() => {
    if (!activeOrderId) return;
    const existing = (orders || []).find((o) => o.id === activeOrderId);
    if (existing?.payment_proof_url !== undefined || existing?.notes !== undefined) return;
    let cancelled = false;
    fetchOrderDetail(activeOrderId)
      .then((row) => {
        if (cancelled || !row) return;
        setOrders((prev) => (prev || []).map((o) => (o.id === row.id ? { ...o, ...row } : o)));
      })
      .catch((e) => warn("fetchOrderDetail:", e));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrderId]);

  // If selected product was deleted / no longer in list, clear selection.
  // Do NOT auto-pick products[0] — that trapped mobile "Daftar" back onto the first item (e.g. Canva).
  useEffect(() => {
    if (!selectedProductId) return;
    if (!products || products.length === 0) {
      setSelectedProductId("");
      return;
    }
    if (!products.some((p) => p.id === selectedProductId)) {
      setSelectedProductId("");
    }
  }, [products, selectedProductId]);

  useEffect(() => {
    setAdminNoteDrafts((prev) => {
      const next = { ...(prev || {}) };
      (orders || []).forEach((order) => {
        const serverNote = String(order.admin_note || "");
        const draft = prev?.[order.id];
        if (draft === undefined || draft === serverNote) {
          next[order.id] = serverNote;
        } else {
          next[order.id] = draft;
        }
      });
      return next;
    });
  }, [orders]);

  const lowStockProductIds = useMemo(() => {
    const ids = new Set();
    for (const product of products || []) {
      const thin = (product.product_variants || []).some(
        (v) => v?.is_active && isThinStock(v?.stock)
      );
      if (thin) ids.add(product.id);
    }
    return ids;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = String(deferredProductQuery || "").trim().toLowerCase();
    let list = products || [];
    if (productStockFilter === "low") {
      list = list.filter((p) => lowStockProductIds.has(p.id));
    }
    if (!q) return list;
    return list.filter((p) => {
      const name = String(p.name || "").toLowerCase();
      const slug = String(p.slug || "").toLowerCase();
      return name.includes(q) || slug.includes(q);
    });
  }, [deferredProductQuery, lowStockProductIds, productStockFilter, products]);

  function openLowStockProducts() {
    setProductStockFilter("low");
    setProductQuery("");
    setVisibleProductsCount(80);
    // Open first thin-stock product so right editor is not empty
    const firstThin = (products || []).find((p) => lowStockProductIds.has(p.id));
    if (firstThin?.id) {
      setSelectedProductId(firstThin.id);
    } else {
      setSelectedProductId("");
    }
    startTransition(() => setTab("products"));
  }

  // When entering low-stock mode after products load, auto-select first thin item
  useEffect(() => {
    if (tab !== "products" || productStockFilter !== "low") return;
    if (selectedProductId && lowStockProductIds.has(selectedProductId)) return;
    const firstThin = (products || []).find((p) => lowStockProductIds.has(p.id));
    if (firstThin?.id) setSelectedProductId(firstThin.id);
  }, [tab, productStockFilter, products, lowStockProductIds, selectedProductId]);

  const selectedProduct = useMemo(() => {
    return (products || []).find((p) => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  const selectedVariants = useMemo(() => {
    return (selectedProduct?.product_variants || [])
      .slice()
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }, [selectedProduct]);

  const nextProductSortOrder = useMemo(() => {
    const highest = (products || []).reduce((max, item) => {
      const value = Number(item?.sort_order);
      return Number.isFinite(value) ? Math.max(max, value) : max;
    }, 0);
    return highest + 10;
  }, [products]);

  const nextVariantSortOrder = useMemo(() => {
    const highest = (selectedVariants || []).reduce((max, item) => {
      const value = Number(item?.sort_order);
      return Number.isFinite(value) ? Math.max(max, value) : max;
    }, 0);
    return highest + 10;
  }, [selectedVariants]);

  const allVariants = useMemo(() => {
    return (products || []).flatMap((product) => product.product_variants || []);
  }, [products]);

  const analyticsDays = analyticsWindow === "30d" ? 30 : 7;
  /** Heavy overview rollup only when needed (overview tab or sidebar stock/live). */
  const shouldComputeOverview = tab === "overview";

  const analyticsSummary = useMemo(() => {
    // Lightweight stub when not on overview — avoid O(orders×items) on every orders keystroke
    if (!shouldComputeOverview) {
      const stockAlerts = (allVariants || [])
        .filter((variant) => variant?.is_active && isThinStock(variant?.stock))
        .sort((a, b) => Number(a?.stock || 0) - Number(b?.stock || 0))
        .slice(0, 6);
      let todayOrders = 0;
      let todayRevenue = 0;
      const todayKey = toDateKeyWIB(new Date());
      for (const order of orders || []) {
        if (toDateKeyWIB(order?.created_at) === todayKey) {
          todayOrders += 1;
          if (String(order?.status) === "done") todayRevenue += Number(order?.total_idr || 0);
        }
      }
      return {
        ...EMPTY_ANALYTICS_SUMMARY,
        todayOrders: todayOrders || storePulse.today_orders || 0,
        todayRevenue,
        stockAlerts,
        activeProducts: (products || []).filter((p) => p.is_active).length,
        inactiveProducts: (products || []).filter((p) => !p.is_active).length,
        activePromos: (promos || []).filter((p) => p.is_active).length,
        activeTestimonials: (testimonials || []).filter((t) => t.is_active).length,
      };
    }

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

    const categoryMap = new Map();
    const promoUsageMap = new Map();

    let revenueTotal = 0;
    let revenueWindow = 0;
    let todayRevenue = 0;
    let todayOrders = 0;
    let doneOrders = 0;
    let pipelineValue = 0;
    let discountTotal = 0;

    // Prefer full daily_stats window for revenue/trend (not clipped to list page)
    const dailyRows = Array.isArray(dailyStats) ? dailyStats : [];
    const revenueFromDaily = dailyRows.reduce((sum, row) => sum + Number(row.revenueIdr || 0), 0);
    const ordersFromDaily = dailyRows.reduce((sum, row) => sum + Number(row.totalOrders || 0), 0);
    if (dailyRows.length) {
      dailyRows.forEach((row) => {
        const key = toDateKeyWIB(row.date);
        if (trendMap.has(key)) {
          const point = trendMap.get(key);
          point.orders = Number(row.totalOrders || 0);
          point.revenue = Number(row.revenueIdr || 0);
        }
      });
      revenueWindow = revenueFromDaily;
    }

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

        if (!dailyRows.length && inWindow) revenueWindow += total;
        if (orderKey === todayKey) todayRevenue += total;
      }

      if (orderKey === todayKey) {
        todayOrders += 1;
      }

      if (!dailyRows.length && inWindow && trendMap.has(orderKey)) {
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
        const productId = item?.product_id;
        const category = prettyCategory(productMap.get(productId)?.category || "other");
        const qty = Number(item?.qty || 0);
        const revenue = Number(item?.price_idr || 0) * qty;
        const categoryEntry = categoryMap.get(category) || { category, quantity: 0, revenue: 0 };
        categoryEntry.quantity += qty;
        categoryEntry.revenue += revenue;
        categoryMap.set(category, categoryEntry);
      });
    });

    // Top products from full catalog sold_count (not limited to loaded order page)
    const topProducts = (products || [])
      .map((product) => {
        const variants = product?.product_variants || [];
        const quantity = variants.reduce((sum, v) => sum + Number(v?.sold_count || 0), 0);
        const revenue = variants.reduce(
          (sum, v) => sum + Number(v?.sold_count || 0) * Number(v?.price_idr || 0),
          0
        );
        return {
          name: product?.name || "Tanpa nama",
          quantity,
          revenue,
        };
      })
      .filter((row) => row.quantity > 0)
      .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
      .slice(0, 5);

    // Prefer exact DB done count when available
    if (orderDbStats.loaded) {
      doneOrders = orderDbStats.done;
      ORDER_STATUS_OPTIONS.forEach((opt) => {
        statusMap[opt.value] = Number(orderDbStats.byStatus?.[opt.value] || 0);
      });
    }

    // Today figures: prefer store pulse + daily when present
    if (storePulse.today_orders) {
      todayOrders = Math.max(todayOrders, Number(storePulse.today_orders || 0));
    }
    if (dailyRows.length) {
      const todayDaily = dailyRows.find((row) => toDateKeyWIB(row.date) === todayKey);
      if (todayDaily) {
        todayRevenue = Math.max(todayRevenue, Number(todayDaily.revenueIdr || 0));
      }
    }

    const stockAlerts = allVariants
      .filter((variant) => variant?.is_active && isThinStock(variant?.stock))
      .sort((a, b) => Number(a?.stock || 0) - Number(b?.stock || 0))
      .slice(0, 6);

    const trend = Array.from(trendMap.values());
    const maxOrders = Math.max(1, ...trend.map((point) => point.orders));
    const maxRevenue = Math.max(1, ...trend.map((point) => point.revenue));
    const totalOrdersForConv = orderDbStats.loaded
      ? orderDbStats.total
      : ordersFromDaily || orders.length;

    return {
      revenueTotal: orderDbStats.loaded && revenueFromDaily ? Math.max(revenueTotal, revenueFromDaily) : revenueTotal || revenueFromDaily,
      revenueWindow,
      todayRevenue,
      todayOrders,
      doneOrders,
      pipelineValue,
      discountTotal,
      averageOrderValue: doneOrders ? (revenueTotal || revenueFromDaily) / doneOrders : 0,
      trend,
      maxOrders,
      maxRevenue,
      statusMap,
      topProducts,
      categories: Array.from(categoryMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 4),
      promoUsage: Array.from(promoUsageMap.values())
        .sort((a, b) => b.orders - a.orders)
        .slice(0, 5),
      stockAlerts,
      conversionRatio: storePulse.total_views
        ? (totalOrdersForConv / storePulse.total_views) * 100
        : 0,
      activeProducts: (products || []).filter((product) => product.is_active).length,
      inactiveProducts: (products || []).filter((product) => !product.is_active).length,
      activePromos: (promos || []).filter((promo) => promo.is_active).length,
      activeTestimonials: (testimonials || []).filter((item) => item.is_active).length,
    };
  }, [
    allVariants,
    analyticsDays,
    dailyStats,
    orderDbStats,
    orders,
    products,
    promos,
    shouldComputeOverview,
    storePulse.today_orders,
    storePulse.total_views,
    testimonials,
  ]);

  const testimonialsWithoutCaption = useMemo(
    () => (testimonials || []).filter((item) => item.is_active && !String(item.caption || "").trim()).length,
    [testimonials]
  );

  const dashboardStats = useMemo(() => {
    return [
      {
        key: "revenue",
        label: `Revenue ${analyticsWindow}`,
        value: formatIDR(analyticsSummary.revenueWindow),
        helper: `${new Intl.NumberFormat("id-ID").format(analyticsSummary.doneOrders)} order sukses`,
        icon: Wallet,
      },
      {
        key: "pipeline",
        label: "Butuh tindak lanjut",
        value: `${orderDbStats.loaded ? orderDbStats.live : orders.filter((order) => LIVE_ORDER_STATUSES.has(String(order.status || "pending"))).length}`,
        helper: formatIDR(analyticsSummary.pipelineValue),
        icon: ClipboardList,
      },
      {
        key: "traffic",
        label: "Views hari ini",
        value: new Intl.NumberFormat("id-ID").format(storePulse.today_views || 0),
        helper: `${new Intl.NumberFormat("id-ID").format(storePulse.today_orders || analyticsSummary.todayOrders)} order masuk`,
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
  }, [analyticsSummary, analyticsWindow, orderDbStats.live, orderDbStats.loaded, orders, storePulse.today_orders, storePulse.today_views]);

  const orderStats = useMemo(() => {
    // Prefer exact DB totals so page size (40) never clips KPI numbers
    if (orderDbStats.loaded) {
      return {
        total: orderDbStats.total,
        live: orderDbStats.live,
        done: orderDbStats.done,
        cancelled: orderDbStats.cancelled,
        paidReported: orderDbStats.paidReported,
        byStatus: orderDbStats.byStatus,
        pageCount: (orders || []).length,
      };
    }
    const byStatus = { pending: 0, pending_payment: 0, paid_reported: 0, processing: 0, done: 0, cancelled: 0, expired: 0 };
    for (const order of orders || []) {
      const key = String(order.status || "pending");
      byStatus[key] = (byStatus[key] || 0) + 1;
    }
    return {
      total: orders.length,
      live: orders.filter((order) => LIVE_ORDER_STATUSES.has(String(order.status || "pending"))).length,
      done: byStatus.done || 0,
      cancelled: (byStatus.cancelled || 0) + (byStatus.expired || 0),
      paidReported: byStatus.paid_reported || 0,
      byStatus,
      pageCount: (orders || []).length,
    };
  }, [orderDbStats, orders]);

  const productCategoryById = useMemo(() => {
    const map = new Map();
    for (const p of products || []) {
      if (p?.id) map.set(p.id, String(p.category || "other").toLowerCase());
    }
    return map;
  }, [products]);

  function isAcademicOrderItem(item) {
    if (!item) return false;
    const catFromProduct = item.product_id ? productCategoryById.get(item.product_id) : null;
    if (catFromProduct === "academic") return true;
    const name = String(item.product_name || item.variant_name || "").toLowerCase();
    return /turnitin|parafrase|paraphrase|plagiasi|zerogpt|mendeley|jasa\s*akademik|cek\s*ai|skripsi|tesis/.test(
      name
    );
  }

  function orderHasAcademicItems(order) {
    return getSafeOrderItems(order).some((item) => isAcademicOrderItem(item));
  }

  function orderHasAppPremiumItems(order) {
    const items = getSafeOrderItems(order);
    if (!items.length) return true; // unknown → treat as app catalog
    return items.some((item) => !isAcademicOrderItem(item));
  }

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

      if (orderCatalogFilter === "academic") {
        if (!orderHasAcademicItems(order)) return false;
      } else if (orderCatalogFilter === "app_premium") {
        if (!orderHasAppPremiumItems(order)) return false;
      }

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
  }, [deferredOrderQuery, orderBucket, orderCatalogFilter, orders, productCategoryById]);

  const activeOrder = useMemo(() => {
    return (orders || []).find((order) => order.id === activeOrderId) || null;
  }, [activeOrderId, orders]);

  useEffect(() => {
    if (!activeOrderId) return;
    if (!(orders || []).some((order) => order.id === activeOrderId)) {
      setActiveOrderId("");
    }
  }, [activeOrderId, orders]);

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

  useEffect(() => {
    requestAdminNotificationPermission().catch(() => {});
  }, []);

  // ===== Realtime subscription for orders (minimal patch + debounced toast) =====
  useEffect(() => {
    const channel = supabase
      .channel("admin-orders-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const newOrder = payload.new;
          if (!newOrder?.id) return;
          // Patch list only if orders domain is loaded
          if (loadedRef.current.orders) {
            setOrders((prev) => {
              if ((prev || []).some((o) => o.id === newOrder.id)) return prev;
              return [newOrder, ...(prev || [])];
            });
          }
          setNewOrderCount((prev) => prev + 1);
          setStorePulse((prev) => ({
            ...prev,
            today_orders: Number(prev.today_orders || 0) + 1,
            total_orders: Number(prev.total_orders || 0) + 1,
          }));
          setOrderDbStats((prev) => {
            if (!prev.loaded) return prev;
            const status = String(newOrder.status || "pending");
            const byStatus = { ...prev.byStatus, [status]: Number(prev.byStatus[status] || 0) + 1 };
            const liveDelta = LIVE_ORDER_STATUSES.has(status) ? 1 : 0;
            return {
              ...prev,
              total: prev.total + 1,
              live: prev.live + liveDelta,
              done: status === "done" ? prev.done + 1 : prev.done,
              cancelled: status === "cancelled" ? prev.cancelled + 1 : prev.cancelled,
              paidReported: status === "paid_reported" ? prev.paidReported + 1 : prev.paidReported,
              byStatus,
            };
          });
          notifyAdminNewOrder(newOrder, waNumber);
          const now = Date.now();
          if (now - realtimeToastAtRef.current >= REALTIME_TOAST_DEBOUNCE_MS) {
            realtimeToastAtRef.current = now;
            toast.success(`Order baru: ${newOrder.order_code || "-"}`, { duration: 4000 });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          const updated = payload.new;
          if (!updated?.id || !loadedRef.current.orders) return;
          // Minimal patch — merge only changed row; do not recompute analytics here
          setOrders((prev) => {
            const list = prev || [];
            const idx = list.findIndex((o) => o.id === updated.id);
            if (idx < 0) return list;
            if (list[idx] === updated) return list;
            const next = list.slice();
            next[idx] = { ...list[idx], ...updated };
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waNumber]);

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
  function makeUniqueProductSlug(name) {
    const base = slugify(name) || `produk-${Date.now().toString(36)}`;
    const taken = new Set((products || []).map((p) => String(p?.slug || "").toLowerCase()));
    if (!taken.has(base)) return base;
    let n = 2;
    while (taken.has(`${base}-${n}`)) n += 1;
    return `${base}-${n}`;
  }

  function openCreateProduct() {
    setNewProduct({
      name: "",
      category: "streaming",
      description: "",
      icon_url: "",
      is_active: true,
    });
    setProductModalOpen(true);
  }

  async function uploadNewProductIcon(file) {
    if (!file) return;
    const tid = toast.loading("Mengupload ikon...");
    try {
      const url = await uploadToBucket(BUCKET_ICONS, file, "icons");
      setNewProduct((p) => ({ ...p, icon_url: url }));
      toast.remove(tid);
      toast.success("Ikon siap", { duration: 1200 });
    } catch (e) {
      toast.remove(tid);
      toast.error("Gagal upload ikon");
      setMsg("Upload ikon gagal. Pastikan bucket Storage public. Detail: " + (e?.message || e));
    }
  }

  async function createProduct() {
    const name = String(newProduct.name || "").trim();
    if (!name) {
      toast.error("Nama produk wajib diisi");
      return;
    }

    const slug = makeUniqueProductSlug(name);
    const category = String(newProduct.category || "other").trim().toLowerCase() || "other";
    const iconUrl = String(newProduct.icon_url || "").trim() || null;

    const tid = toast.loading("Membuat produk");
    setMsg("");

    try {
      const insertPayload = {
        name,
        slug,
        category,
        description: String(newProduct.description || "").trim(),
        icon_url: iconUrl,
        is_active: newProduct.is_active !== false,
        sort_order: nextProductSortOrder,
      };

      let { data, error } = await supabase.from("products").insert(insertPayload).select("id,category,name").single();

      // Older DBs may not have category yet - surface a clear fix path
      if (error && /category/i.test(String(error.message || ""))) {
        throw new Error(
          "Kolom products.category belum ada di database. Jalankan migrasi supabase/migrations/003_products_category.sql di Supabase SQL Editor."
        );
      }
      if (error) throw error;
      if (!data?.id) throw new Error("Insert produk gagal (tidak ada data kembali). Cek RLS admin.");

      invalidateProductCaches();
      await refreshProducts({ force: true });
      setSelectedProductId(data.id);
      setProductModalOpen(false);
      toast.remove(tid);
      toast.success(`Produk "${name}" dibuat. Lanjut tambah paket/variannya ya.`, { duration: 2200 });
    } catch (e) {
      toast.remove(tid);
      const message = e?.message || String(e);
      toast.error(message.includes("category") ? "Gagal: kolom category" : "Gagal membuat produk");
      setMsg(message);
    }
  }

  async function saveProduct() {
    if (!productForm?.id) return;

    const category = String(productForm.category || "other").trim().toLowerCase() || "other";
    const payload = {
      name: String(productForm.name || "").trim(),
      slug: String(productForm.slug || "").trim() || slugify(productForm.name),
      category,
      description: String(productForm.description || ""),
      icon_url: productForm.icon_url ? String(productForm.icon_url) : null,
      is_active: !!productForm.is_active,
      sort_order: Number.isFinite(Number(productForm.sort_order))
        ? Number(productForm.sort_order)
        : Number(selectedProduct?.sort_order || 100),
      updated_at: new Date().toISOString(),
    };

    if (!payload.name) {
      toast.error("Nama produk wajib diisi");
      return;
    }

    const tid = toast.loading("Menyimpan produk");
    setMsg("");

    try {
      const runUpdate = async (body) =>
        supabase
          .from("products")
          .update(body)
          .eq("id", productForm.id)
          .select("id,category,name,slug")
          .maybeSingle();

      const formatPgError = (err) => {
        if (!err) return "Unknown error";
        const parts = [
          err.message,
          err.details ? `detail: ${err.details}` : null,
          err.hint ? `hint: ${err.hint}` : null,
          err.code ? `code: ${err.code}` : null,
        ].filter(Boolean);
        return parts.join(" · ");
      };

      let { data, error } = await runUpdate(payload);

      // Retry without updated_at if column missing
      if (error && /updated_at|PGRST204|42703/i.test(`${error.message || ""} ${error.code || ""} ${error.details || ""}`)) {
        const { updated_at: _drop, ...withoutTs } = payload;
        ({ data, error } = await runUpdate(withoutTs));
      }

      if (error) {
        const raw = `${error.message || ""} ${error.details || ""} ${error.hint || ""} ${error.code || ""}`;
        // Enum / CHECK missing allowed category key (e.g. ai, design, academic)
        if (/invalid input value for enum|check constraint|category/i.test(raw)) {
          const migrationHint =
            category === "academic"
              ? "supabase/migrations/004_products_category_academic.sql"
              : "supabase/migrations/003_products_category.sql (atau 004 jika kategori Jasa Akademik)";
          throw new Error(
            `Kategori ditolak database (${category}). ` +
              `Biasanya ENUM/CHECK lama belum mengizinkan nilai ini. ` +
              `Jalankan script ${migrationHint} di Supabase SQL Editor, ` +
              `lalu reload schema (Settings → API → Reload schema) dan coba lagi. ` +
              `PG: ${formatPgError(error)}`
          );
        }
        throw new Error(formatPgError(error));
      }

      // RLS can return 200 with 0 rows - treat as failure
      if (!data?.id) {
        throw new Error(
          "Update tidak diterapkan (0 baris). Pastikan login admin valid dan policy products mengizinkan UPDATE."
        );
      }

      if (String(data.category || "").toLowerCase() !== category) {
        throw new Error(
          `Kategori tidak tersimpan (DB: "${data.category || "null"}", diminta: "${category}"). Cek kolom category & RLS.`
        );
      }

      invalidateProductCaches();
      await refreshProducts({ force: true });
      // Keep editor form in sync with confirmed DB category
      setProductForm((prev) => (prev ? { ...prev, category: data.category || category } : prev));
      toast.remove(tid);
      toast.success(`Produk disimpan · ${prettyCategory(data.category)}`, { duration: 1600 });
    } catch (e) {
      toast.remove(tid);
      const message = e?.message || String(e);
      toast.error("Gagal menyimpan produk");
      setMsg(message);
      warn("[admin] saveProduct failed", e);
    }
  }

  function deleteProduct(id) {
    if (!id) return;
    openConfirm({
      title: "Hapus produk",
      message: "Hapus produk ini beserta variannya?",
      confirmLabel: "Ya, hapus",
      danger: true,
      onConfirm: () => runDeleteProduct(id),
    });
  }

  async function runDeleteProduct(id) {
    const tid = toast.loading("Menghapus produk");
    setMsg("");

    try {
      // 1. Delete any related flash sales first to prevent FK violation
      const { data: vars } = await supabase.from("product_variants").select("id").eq("product_id", id);
      const varIds = (vars || []).map((v) => v.id);
      if (varIds.length > 0) {
        await supabase.from("flash_sales").delete().in("variant_id", varIds);
      }

      // 2. Delete variants next
      const { error: vErr } = await supabase.from("product_variants").delete().eq("product_id", id);
      if (vErr) throw vErr;

      // 3. Delete product
      const { error: pErr } = await supabase.from("products").delete().eq("id", id);
      if (pErr) throw pErr;

      invalidateProductCaches();
      await refreshProducts({ force: true });
      toast.remove(tid);
      toast.success("Produk dihapus", { duration: 1400 });
    } catch (e) {
      toast.remove(tid);
      const errText = String(e?.message || e || "");
      if (e?.code === "23503" || errText.includes("foreign key") || errText.includes("violates foreign key")) {
        toast.error("Produk memiliki riwayat order dan tidak bisa dihapus permanen. Nonaktifkan saja statusnya.");
      } else {
        toast.error("Gagal menghapus produk");
      }
      setMsg(e?.message || String(e));
    }
  }

  async function uploadProductIcon(file) {
    if (!selectedProduct) return;
    if (!file) return;

    const tid = toast.loading("Upload ikon");
    setMsg("");

    try {
      const url = await uploadToBucket(BUCKET_ICONS, file, "icons");
      const { error } = await supabase
        .from("products")
        .update({ icon_url: url, updated_at: new Date().toISOString() })
        .eq("id", selectedProduct.id);
      if (error) throw error;

      setProductForm((p) => (p ? { ...p, icon_url: url } : p));
      invalidateProductCaches();
      await refreshProducts({ force: true });

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
      duration_label: "1 bulan",
      description: "",
      price_idr: "",
      guarantee_text: "All full garansi",
      stock: 10,
      is_active: true,
      requires_buyer_email: false,
      sort_order: nextVariantSortOrder,
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
      requires_buyer_email: !!v.requires_buyer_email,
      sort_order: Number(v.sort_order || 100),
    });
    setVariantModalOpen(true);
  }

  async function saveVariant() {
    if (!variantForm?.product_id) return;

    const activeVariantSort = Number(variantForm.sort_order);
    const fallbackSortOrder = variantMode === "create" ? nextVariantSortOrder : 100;
    const name = String(variantForm.name || "").trim();
    // Durasi optional in UI: default from name or "1 bulan"
    const duration =
      String(variantForm.duration_label || "").trim() ||
      (name ? name : "1 bulan");

    const payload = {
      product_id: variantForm.product_id,
      name: name || duration,
      duration_label: duration,
      description: String(variantForm.description || ""),
      price_idr: Number(variantForm.price_idr || 0),
      guarantee_text: String(variantForm.guarantee_text || "All full garansi"),
      stock: Number(variantForm.stock || 0),
      is_active: variantForm.is_active !== false,
      requires_buyer_email: !!variantForm.requires_buyer_email,
      sort_order: Number.isFinite(activeVariantSort) ? activeVariantSort : fallbackSortOrder,
      updated_at: new Date().toISOString(),
    };

    if (!payload.name) {
      toast.error("Nama paket wajib diisi");
      return;
    }
    if (variantForm.price_idr === "" || variantForm.price_idr == null || Number.isNaN(Number(variantForm.price_idr))) {
      toast.error("Harga wajib diisi");
      return;
    }
    if (payload.price_idr < 0) {
      toast.error("Harga tidak boleh negatif");
      return;
    }

    const tid = toast.loading(variantMode === "edit" ? "Menyimpan varian..." : "Menambah varian...");
    setMsg("");

    try {
      if (variantMode === "edit") {
        const { data, error } = await supabase
          .from("product_variants")
          .update(payload)
          .eq("id", variantForm.id)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (!data?.id) throw new Error("Varian tidak ditemukan atau akses ditolak.");
      } else {
        const { data, error } = await supabase
          .from("product_variants")
          .insert({
            ...payload,
            created_at: new Date().toISOString(),
          })
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (!data?.id) throw new Error("Varian gagal ditambahkan.");
      }

      invalidateProductCaches();
      await refreshProducts({ force: true });
      setVariantModalOpen(false);
      toast.remove(tid);
      toast.success(variantMode === "edit" ? "Paket diperbarui" : "Paket ditambahkan", { duration: 1400 });
    } catch (e) {
      toast.remove(tid);
      const rawMessage = String(e?.message || e || "");
      const msgLower = rawMessage.toLowerCase();
      if (e?.code === "23505" || msgLower.includes("product_variants_unique") || msgLower.includes("duplicate key value")) {
        toast.error("Database masih memblokir duplikat nama+durasi. Jalankan query SQL update constraint dulu.");
      } else if (e?.code === "42501" || msgLower.includes("row-level security") || msgLower.includes("permission denied")) {
        toast.error("Akses ditolak. Coba login ulang admin.");
      } else {
        toast.error("Gagal menyimpan varian");
      }
      setMsg(rawMessage || "Terjadi error saat menyimpan varian.");
    }
  }

  async function deleteVariant(id) {
    if (!id) return;
    openConfirm({
      title: "Hapus varian",
      message: "Hapus varian ini?",
      confirmLabel: "Ya, hapus",
      danger: true,
      onConfirm: () => runDeleteVariant(id),
    });
  }

  async function runDeleteVariant(id) {
    const tid = toast.loading("Menghapus varian");
    setMsg("");

    try {
      // 1. Delete related flash sale if any
      await supabase.from("flash_sales").delete().eq("variant_id", id);

      // 2. Delete variant
      const { error } = await supabase.from("product_variants").delete().eq("id", id);
      if (error) throw error;

      invalidateProductCaches();
      await refreshProducts({ force: true });
      toast.remove(tid);
      toast.success("Varian dihapus", { duration: 1400 });
    } catch (e) {
      toast.remove(tid);
      const errText = String(e?.message || e || "");
      if (e?.code === "23503" || errText.includes("foreign key") || errText.includes("violates foreign key")) {
        toast.error("Paket ini memiliki riwayat order dan tidak bisa dihapus permanen. Nonaktifkan saja statusnya.");
      } else {
        toast.error("Gagal menghapus varian");
      }
      setMsg(e?.message || String(e));
    }
  }

  // ===== Orders actions =====

  function getOrdersForExport() {
    let list = filteredOrders;
    if (exportDateFrom) {
      const from = new Date(`${exportDateFrom}T00:00:00`).getTime();
      list = list.filter((order) => new Date(order.created_at).getTime() >= from);
    }
    if (exportDateTo) {
      const to = new Date(`${exportDateTo}T23:59:59`).getTime();
      list = list.filter((order) => new Date(order.created_at).getTime() <= to);
    }
    return list;
  }

  async function handleExportCSV() {
    const tid = toast.loading("Menyiapkan data ekspor CSV...");
    try {
      let exportList = [];
      let query = supabase.from("orders").select(ORDER_SELECT_DETAIL).order("created_at", { ascending: false });
      if (exportDateFrom) {
        query = query.gte("created_at", `${exportDateFrom}T00:00:00`);
      }
      if (exportDateTo) {
        query = query.lte("created_at", `${exportDateTo}T23:59:59.999`);
      }
      const { data, error } = await query;
      if (!error && Array.isArray(data) && data.length > 0) {
        exportList = data;
      } else {
        exportList = getOrdersForExport();
      }

      if (!exportList.length) {
        toast.remove(tid);
        toast.error("Tidak ada order untuk diekspor");
        return;
      }
      const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
      const csv = buildOrdersCSV(exportList);
      const rangeSuffix = exportDateFrom || exportDateTo ? `-${exportDateFrom || "start"}_${exportDateTo || "end"}` : "";
      downloadCSV(csv, `orders-${today}${rangeSuffix}.csv`);
      toast.remove(tid);
      toast.success(`${exportList.length} order diekspor`);
    } catch {
      toast.remove(tid);
      const fallbackList = getOrdersForExport();
      if (!fallbackList.length) {
        toast.error("Tidak ada order untuk diekspor");
        return;
      }
      const today = new Date().toLocaleDateString("en-CA");
      const csv = buildOrdersCSV(fallbackList);
      const rangeSuffix = exportDateFrom || exportDateTo ? `-${exportDateFrom || "start"}_${exportDateTo || "end"}` : "";
      downloadCSV(csv, `orders-${today}${rangeSuffix}.csv`);
      toast.success(`${fallbackList.length} order diekspor`);
    }
  }

  function buildCustomerWaUrl(order) {
    const digits = normalizeWhatsApp(order?.customer_whatsapp || "");
    if (!digits) return "";
    const statusLabel = prettyOrderStatus(order?.status);
    const text = encodeURIComponent(
      `Halo kak,\n\nUpdate order kamu:\n\nID Order: ${order?.order_code || "-"}\nStatus: ${statusLabel}\nTotal: ${formatIDR(order?.total_idr || 0)}\n\nTerima kasih sudah berbelanja di Imzaqi Store.`
    );
    return `https://wa.me/${digits}?text=${text}`;
  }

  function bulkUpdateStatus(newStatus) {
    const ids = Array.from(selectedOrderIds);
    if (!ids.length) return;
    const label = newStatus === "done" ? "selesai" : "dibatalkan";
    openConfirm({
      title: "Konfirmasi bulk",
      message: `Tandai ${ids.length} order sebagai ${label}?`,
      confirmLabel: "Ya, lanjutkan",
      danger: newStatus === "cancelled",
      onConfirm: () => runBulkUpdateStatus(newStatus, ids),
    });
  }

  async function runBulkUpdateStatus(newStatus, ids) {
    const tid = toast.loading(`Memperbarui ${ids.length} order...`);
    
    let succeededIds = [];
    let failedIds = [];

    if (newStatus === "cancelled") {
      // Cancellation has custom database side effects (stock restore rpc), so must run individually
      const results = await Promise.allSettled(
        ids.map((id) => supabase.rpc("cancel_order_with_stock_restore", { p_order_id: id }))
      );
      results.forEach((r, idx) => {
        const id = ids[idx];
        if (r.status === "fulfilled" && !r.value?.error) {
          succeededIds.push(id);
        } else {
          failedIds.push(id);
        }
      });
      invalidateProductCaches();
      await refreshProducts({ force: true });
    } else {
      // Bulk update is much more efficient using Supabase .in() operator
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .in("id", ids);

      if (error) {
        failedIds = ids;
      } else {
        succeededIds = ids;
      }
    }

    toast.remove(tid);

    const succeeded = succeededIds.length;
    const failed = failedIds.length;

    if (failed === 0) {
      toast.success(`${succeeded} order diperbarui`);
      setSelectedOrderIds(new Set());
    } else {
      toast.error(`${succeeded} berhasil, ${failed} gagal`);
      // Selectively retain only failed IDs in the selection set
      setSelectedOrderIds(new Set(failedIds));
    }

    await refreshOrders();
  }

  async function copyStatusLink(orderCode) {
    const url = `${window.location.origin}/status?order=${encodeURIComponent(orderCode)}`;
    try {
      await copyToClipboard(url);
      toast.success("Link status disalin");
    } catch {
      toast.error("Gagal menyalin link");
    }
  }

  async function copyCustomerPhone(phone) {
    const raw = String(phone || "").trim();
    if (!raw) {
      toast.error("Nomor WA kosong");
      return;
    }
    try {
      await copyToClipboard(raw);
      toast.success("Nomor WA disalin");
    } catch {
      toast.error("Gagal menyalin nomor");
    }
  }

  async function updateOrderStatus(orderId, status) {
    const tid = toast.loading("Update status");
    setMsg("");

    try {
      // Find the order to get whatsapp number for notification
      const orderToUpdate = orders.find((o) => o.id === orderId);
      const customerWa = orderToUpdate?.customer_whatsapp || "";

      if (status === "cancelled") {
        // Use RPC that atomically restores stock + promo slot
        const { data, error } = await supabase.rpc("cancel_order_with_stock_restore", {
          p_order_id: orderId,
        });
        if (error) throw error;
        const result = data || {};
        const extra = result.restored_stock
          ? ` (stok +${result.restored_stock}${result.restored_promo ? ", promo dikembalikan" : ""})`
          : "";
        invalidateProductCaches();
        await Promise.all([refreshOrders(), refreshProducts({ force: true })]);
        toast.remove(tid);

        // Toast with WA redirect button for cancellation
        if (customerWa) {
          const waDigits = normalizeWhatsApp(customerWa);
          const orderCode = orderToUpdate?.order_code || "-";
          const total = formatIDR(orderToUpdate?.total_idr || 0);
          const text = encodeURIComponent(
            `Halo kak,\n\nOrder kamu dengan ID ${orderCode} telah dibatalkan.\n\nTotal: ${total}\n\nJika ada pertanyaan, silakan hubungi admin.\n\nTerima kasih.`
          );
          const waUrl = `https://wa.me/${waDigits}?text=${text}`;
          toast.success(`Order dibatalkan${extra}`, {
            actionLabel: "Kirim WA",
            onAction: () => {
              window.open(waUrl, "_blank");
            },
            duration: 6000
          });
        } else {
          toast.success(`Order dibatalkan${extra}`, { duration: 2400 });
        }
      } else {
        const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
        if (error) throw error;
        await refreshOrders();
        toast.remove(tid);

        const statusLabel = prettyOrderStatus(status);
        // Toast with WA redirect button for status updates
        if (customerWa) {
          const waDigits = normalizeWhatsApp(customerWa);
          const orderCode = orderToUpdate?.order_code || "-";
          const total = formatIDR(orderToUpdate?.total_idr || 0);
          const text = encodeURIComponent(
            `Halo kak,\n\nUpdate order kamu:\n\nID Order: ${orderCode}\nStatus: ${statusLabel}\nTotal: ${total}\n\nTerima kasih sudah berbelanja di Imzaqi Store.`
          );
          const waUrl = `https://wa.me/${waDigits}?text=${text}`;
          toast.success(`Status diperbarui ke ${statusLabel}`, {
            actionLabel: "Kirim WA",
            onAction: () => {
              window.open(waUrl, "_blank");
            },
            duration: 6000
          });
        } else {
          toast.success(`Status diperbarui ke ${statusLabel}`, { duration: 1200 });
        }
      }
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

    const tid = toast.loading("Menyimpan promo");
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
    const tid = toast.loading("Update promo");
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

  async function savePromoForm() {
    const code = String(promoForm.code || "").trim().toUpperCase();
    const percent = Number(promoForm.percent);
    if (!code) { toast.error("Kode promo wajib diisi"); return; }
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) { toast.error("Diskon harus 1–100%"); return; }

    const row = {
      code,
      percent,
      is_active: true,
      updated_at: new Date().toISOString(),
      ...(promoForm.expired_at ? { expired_at: promoForm.expired_at } : { expired_at: null }),
      ...(promoForm.max_uses !== "" && promoForm.max_uses != null
        ? { max_uses: Number(promoForm.max_uses) }
        : { max_uses: null }),
    };

    const tid = toast.loading(promoFormMode === "edit" ? "Menyimpan perubahan" : "Membuat promo");
    try {
      const { error } = await supabase.from("promo_codes").upsert([row], { onConflict: "code" });
      if (error) {
        // Database constraint violation - percent likely exceeds DB limit
        if (error.message?.includes("promo_codes_percent_check")) {
          toast.remove(tid);
          toast.error("Database membatasi diskon maksimal 99%. Ubah constraint di Supabase SQL Editor: ALTER TABLE promo_codes DROP CONSTRAINT promo_codes_percent_check; ALTER TABLE promo_codes ADD CONSTRAINT promo_codes_percent_check CHECK (percent >= 1 AND percent <= 100);");
          return;
        }
        throw error;
      }
      setPromos(await fetchPromoCodes());
      setPromoFormOpen(false);
      setPromoForm(PROMO_FORM_EMPTY);
      toast.remove(tid);
      toast.success(promoFormMode === "edit" ? "Promo diperbarui" : "Promo dibuat", { duration: 1400 });
    } catch (e) {
      toast.remove(tid);
      toast.error("Gagal simpan promo");
      setMsg(e?.message || String(e));
    }
  }

  async function toggleHomePromo(code) {
    const visibleCodes = settings?.home_promos?.codes || [];
    let nextCodes;
    if (visibleCodes.includes(code)) {
      nextCodes = visibleCodes.filter((c) => c !== code);
    } else {
      nextCodes = [...visibleCodes, code];
    }

    const tid = toast.loading("Mengubah pengaturan tampilan Home...");
    try {
      await upsertSetting("home_promos", { codes: nextCodes });

      setSettings((prev) => ({
        ...prev,
        home_promos: { codes: nextCodes },
      }));
      toast.remove(tid);
      toast.success("Kupon beranda dan label atas diperbarui!");
    } catch (e) {
      toast.remove(tid);
      toast.error("Gagal menyimpan pengaturan.");
      setMsg(e?.message || String(e));
    }
  }

  async function deletePromo(code) {
    setPromoDeleteTarget(code);
  }

  async function confirmDeletePromo() {
    const code = promoDeleteTarget;
    setPromoDeleteTarget(null);
    if (!code) return;
    const tid = toast.loading("Menghapus promo");
    try {
      // 1. Delete associated claims if any to prevent FK violation
      await supabase.from("promo_claims").delete().eq("code", code);

      // 2. Delete promo code
      const { error } = await supabase.from("promo_codes").delete().eq("code", code);
      if (error) throw error;
      setPromos(await fetchPromoCodes());
      toast.remove(tid);
      toast.success("Promo dihapus", { duration: 1400 });
    } catch (e) {
      toast.remove(tid);
      const errText = String(e?.message || e || "");
      if (e?.code === "23503" || errText.includes("foreign key") || errText.includes("violates foreign key")) {
        toast.error("Kode promo memiliki riwayat klaim/order. Nonaktifkan status promo saja.");
      } else {
        toast.error("Gagal hapus promo");
      }
      setMsg(e?.message || String(e));
    }
  }

  function openCreatePromo() {
    setPromoForm(PROMO_FORM_EMPTY);
    setPromoFormMode("create");
    setPromoFormOpen(true);
  }

  function openEditPromo(p) {
    setPromoForm({
      code: p.code,
      percent: String(p.percent),
      expired_at: p.expired_at ? p.expired_at.slice(0, 10) : "",
      max_uses: p.max_uses != null ? String(p.max_uses) : "",
    });
    setPromoFormMode("edit");
    setPromoFormOpen(true);
  }

  function copyPromoCode(code) {
    copyToClipboard(code).catch(() => {});
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(""), 1800);
  }

  // ===== Testimonials actions (multi) =====
  async function addTestimonials(e) {
    e.preventDefault();
    setMsg("");

    const files = Array.from(e.target.elements.files.files || []);
    const caption = e.target.elements.caption.value || "";
    const customerName = e.target.elements.customer_name.value || "";
    const productName = e.target.elements.product_name.value || "";
    const purchasedAt = e.target.elements.purchased_at.value || null;
    const isVerified = e.target.elements.is_verified.checked;

    if (files.length === 0) {
      toast.error("Pilih minimal 1 gambar");
      return;
    }

    const tid = toast.loading("Upload testimoni");

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
        customer_name: customerName.trim() || null,
        product_name: productName.trim() || null,
        purchased_at: purchasedAt ? new Date(purchasedAt).toISOString() : null,
        is_verified: isVerified,
        is_active: true,
        sort_order: 100,
      }));

      const { error } = await supabase.from("testimonials").insert(payload);
      if (error) throw error;

      invalidateTestimonialsCache();
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
    const tid = toast.loading("Update testimoni");
    try {
      const { error } = await supabase.from("testimonials").update(patch).eq("id", id);
      if (error) throw error;
      invalidateTestimonialsCache();
      setTestimonials(await fetchTestimonials({ includeInactive: true }));
      toast.remove(tid);
    } catch (e) {
      toast.remove(tid);
      toast.error("Gagal update testimoni");
      setMsg(e?.message || String(e));
    }
  }

  function deleteTestimonial(id) {
    if (!id) return;
    openConfirm({
      title: "Hapus testimoni",
      message: "Hapus testimoni ini?",
      confirmLabel: "Ya, hapus",
      danger: true,
      onConfirm: () => runDeleteTestimonial(id),
    });
  }

  async function runDeleteTestimonial(id) {

    const tid = toast.loading("Menghapus");
    try {
      const { error } = await supabase.from("testimonials").delete().eq("id", id);
      if (error) throw error;
      invalidateTestimonialsCache();
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
    const tid = toast.loading("Simpan WA");

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
    const tid = toast.loading("Simpan QRIS");

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

  async function saveAcademicPopupSettings(enabled) {
    const tid = toast.loading("Simpan setting pop-up akademik");
    try {
      await upsertSetting("academic_popup", { enabled: Boolean(enabled) });
      const nextSettings = await fetchSettings({ useCache: false });
      setSettings(nextSettings);
      setSettingsAcademicPopupEnabled(Boolean(enabled));
      toast.remove(tid);
      toast.success("Status Pop-Up Akademik disimpan", { duration: 1200 });
    } catch (e) {
      toast.remove(tid);
      toast.error("Gagal menyimpan status pop-up");
      setMsg(e?.message || String(e));
    }
  }

  // ===== Render =====
  const tabs = [
    { id: "overview", label: "Ringkasan", hint: "Apa yang perlu dikerjakan sekarang" },
    { id: "products", label: "Produk", hint: "Katalog, paket, dan stok" },
    { id: "orders", label: "Pesanan", hint: "Antrean bayar & proses" },
    { id: "promos", label: "Promo", hint: "Kode diskon pelanggan" },
    { id: "flashsale", label: "Flash Sale", hint: "Diskon kilat per varian" },
    { id: "testimonials", label: "Testimoni", hint: "Bukti sosial di etalase" },
    { id: "settings", label: "Pengaturan", hint: "WA, QRIS, operasional" },
  ];

  const activeTab = tabs.find((item) => item.id === tab) || tabs[0];
  const liveFlashCount = flashSales.filter((fs) => {
    const now = new Date();
    return fs.is_active && new Date(fs.ends_at) >= now && new Date(fs.starts_at) <= now;
  }).length;
  const syncCopy = loading
    ? "Menyelaraskan data..."
    : lastSyncedAt
      ? `Sinkron ${formatAdminDate(lastSyncedAt)}`
      : "Belum sinkron";

  const primaryWorkspaceAction = {
    overview: {
      label: orderStats.live > 0 ? "Proses pesanan" : "Lihat pesanan",
      onClick: () => handleSelectTab("orders"),
      icon: ClipboardList,
    },
    orders: {
      label: "Export CSV",
      onClick: handleExportCSV,
      icon: ClipboardList,
    },
    products: {
      label: "Tambah produk",
      onClick: openCreateProduct,
      icon: Plus,
    },
    promos: {
      label: "Buat promo",
      onClick: openCreatePromo,
      icon: Plus,
    },
    flashsale: {
      label: "Buat flash sale",
      onClick: () => setFlashFormOpen(true),
      icon: Plus,
    },
    testimonials: null,
    settings: null,
  }[activeTab.id];

  const activeOrderWhatsApp = activeOrder ? buildWhatsAppLink(activeOrder.customer_whatsapp) : "";
  const flashSaleEndingSoon = flashSales.some((fs) => {
    const now = new Date();
    const end = new Date(fs.ends_at);
    const diff = end - now;
    return fs.is_active && diff > 0 && diff < 2 * 60 * 60 * 1000;
  });

  function handleSelectTab(id, opts = {}) {
    if (id === "products" && opts?.lowStock) {
      openLowStockProducts();
      return;
    }
    if (id === "products" && !opts?.lowStock) {
      // Keep stock filter if user already filtered; only clear when switching from other tabs intentionally
    }
    if (id !== "products") {
      // leave productStockFilter as-is so returning to products remembers filter
    }
    startTransition(() => setTab(id));
    if (id === "orders") setNewOrderCount(0);
  }

  const adminGreetingName = useMemo(() => {
    const email = String(adminEmail || "").toLowerCase();
    if (email.includes("rojaki")) return "Bos Zaqi";
    if (email.includes("kambingbiru")) return "King Agta";
    if (email) return email.split("@")[0] || "Admin";
    return "Admin";
  }, [adminEmail]);

  const PrimaryActionIcon = primaryWorkspaceAction?.icon || Plus;

  return (
    <div className="page admin-page admin-page--app">
      <section className="section admin-section">
        <div className="admin-shell">
          <AdminSidebar
            tabs={tabs}
            activeTabId={tab}
            onSelectTab={handleSelectTab}
            icons={TAB_ICONS}
            greetingName={adminGreetingName}
            todayOrders={analyticsSummary.todayOrders}
            todayRevenue={formatIDR(analyticsSummary.todayRevenue)}
            liveOrders={orderStats.live}
            newOrderCount={newOrderCount}
            stockAlertCount={analyticsSummary.stockAlerts.length}
            flashSaleEndingSoon={flashSaleEndingSoon}
            onRefresh={refreshAll}
            onLogout={logout}
            syncLabel={syncCopy}
          />

          <main className="admin-main">
            {/* Slim action bar only — tab title lives inside each pane (no double header) */}
            <div className="admin-workspaceToolbar" role="toolbar" aria-label="Aksi halaman">
              <div className="admin-workspaceSync" title={syncCopy}>
                <span className={`admin-syncDot${loading ? " is-loading" : ""}`} />
                <span>{syncCopy}</span>
              </div>
              <div className="admin-workspaceToolbarActions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={refreshAll}>
                  <Eye size={15} />
                  Refresh
                </button>
                {primaryWorkspaceAction ? (
                  <button type="button" className="btn btn-primary btn-sm" onClick={primaryWorkspaceAction.onClick}>
                    <PrimaryActionIcon size={15} />
                    {primaryWorkspaceAction.label}
                  </button>
                ) : null}
              </div>
            </div>

            <AdminMobileNav
              tabs={tabs}
              activeTabId={tab}
              onSelectTab={handleSelectTab}
              icons={TAB_ICONS}
              newOrderCount={newOrderCount}
              stockAlertCount={analyticsSummary.stockAlerts.length}
              flashSaleEndingSoon={flashSaleEndingSoon}
              onRefresh={refreshAll}
              onLogout={logout}
            />

            {msg ? (
              <div className={`admin-alert${msgIsError ? " is-error" : ""}`} role="alert">
                <b>{msgIsError ? "Perlu diperbaiki" : "Info"}</b>
                <span>{msg}</span>
                <button type="button" className="admin-alertDismiss" onClick={() => setMsg("")} aria-label="Tutup">
                  <X size={14} />
                </button>
              </div>
            ) : null}

            {loading && !lastSyncedAt ? (
              <div className="admin-initialLoad" role="status" aria-label="Memuat dashboard">
                <div className="admin-initialLoadCard">
                  <div className="skeleton" style={{ height: 20, width: "40%", borderRadius: 8 }} />
                  <div className="skeleton" style={{ height: 14, width: "70%", marginTop: 10, borderRadius: 8 }} />
                  <div className="skeleton" style={{ height: 120, marginTop: 18, borderRadius: 16 }} />
                  <div className="skeleton" style={{ height: 180, marginTop: 12, borderRadius: 16 }} />
                </div>
              </div>
            ) : null}

            {tab === "overview" ? (
              <div className="admin-overview admin-workspaceScroll">
                <section className="admin-priorityBoard" aria-label="Antrian prioritas">
                  <div className="admin-priorityBoardHead">
                    <div>
                      <div className="admin-sectionKicker">Fokus sekarang</div>
                      <h2 className="admin-sectionTitle">Kerjakan dulu</h2>
                    </div>
                  </div>
                  <div className="admin-priorityGrid">
                    <button
                      type="button"
                      className="admin-priorityCard"
                      onClick={() => {
                        setOrderBucket("attention");
                        handleSelectTab("orders");
                      }}
                    >
                      <span className="admin-priorityIcon admin-priorityIcon--orders"><ClipboardList size={18} /></span>
                      <strong>{orderStats.live}</strong>
                      <span>Order aksi</span>
                      <small>{newOrderCount > 0 ? `${newOrderCount} baru` : "Buka antrean"}</small>
                    </button>
                    <button type="button" className="admin-priorityCard" onClick={openLowStockProducts}>
                      <span className="admin-priorityIcon admin-priorityIcon--stock"><AlertTriangle size={18} /></span>
                      <strong>{analyticsSummary.stockAlerts.length}</strong>
                      <span>Stok tipis</span>
                      <small>Restock</small>
                    </button>
                    <button type="button" className="admin-priorityCard" onClick={() => handleSelectTab("flashsale")}>
                      <span className="admin-priorityIcon admin-priorityIcon--flash"><TrendingUp size={18} /></span>
                      <strong>{liveFlashCount}</strong>
                      <span>Flash live</span>
                      <small>{flashSaleEndingSoon ? "Hampir habis" : "Kelola"}</small>
                    </button>
                  </div>
                </section>

                <div className="admin-stats admin-stats--compact">
                  {dashboardStats.slice(0, 4).map((stat) => {
                    const StatIcon = stat.icon || TAB_ICONS[stat.key] || Box;
                    return (
                      <div key={stat.key} className="admin-statCard">
                        <span className="admin-statIcon">
                          <StatIcon size={16} />
                        </span>
                        <span className="admin-statLabel">{stat.label}</span>
                        <strong className="admin-statValue">{stat.value}</strong>
                        <span className="admin-statHelper admin-desktopOnly">{stat.helper}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="admin-panel admin-overviewHero">
                  <div className="admin-panel-body">
                    <div className="admin-overviewHeroTop">
                      <div>
                        <div className="admin-topbar-eyebrow">Kesehatan toko</div>
                        <div className="admin-heroTitle">Performa & tren</div>
                        <div className="admin-panel-sub">
                          Revenue, order selesai, dan sinyal operasional.
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
                        <strong>{formatIDR(analyticsSummary.revenueTotal)}</strong>
                        <small>{analyticsSummary.doneOrders} order sukses</small>
                      </div>
                      <div className="admin-miniCard">
                        <span>Revenue hari ini</span>
                        <strong>{formatIDR(analyticsSummary.todayRevenue)}</strong>
                        <small>{analyticsSummary.todayOrders} order masuk</small>
                      </div>
                      <div className="admin-miniCard">
                        <span>Rata-rata order</span>
                        <strong>{formatIDR(analyticsSummary.averageOrderValue)}</strong>
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
                        <div className="admin-panel-sub">Ritme toko harian - order masuk vs revenue selesai.</div>
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
                              <strong>{formatIDR(point.revenue)}</strong>
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
                        <div className="admin-panel-sub">Mana yang perlu di-follow up duluan.</div>
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
                        <div className="admin-panel-sub">Akumulasi sold_count katalog (semua periode).</div>
                      </div>
                    </div>
                    <div className="admin-panel-body admin-stack">
                      {analyticsSummary.topProducts.length ? (
                        analyticsSummary.topProducts.map((item, index) => (
                          <div key={item.name} className="admin-rankItem">
                            <div className="admin-rankIndex">#{index + 1}</div>
                            <div className="admin-rankCopy">
                              <strong>{item.name}</strong>
                              <small>
                                {new Intl.NumberFormat("id-ID").format(item.quantity)} item terjual
                              </small>
                            </div>
                            <div className="admin-rankMeta">{formatIDR(item.revenue)}</div>
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
                        <div className="admin-panel-sub">Insight promo aktif dan distribusi kategori.</div>
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
                        <div className="admin-miniCard">
                          <span>Flash sale aktif</span>
                          <strong>{flashSales.filter(fs => { const now = new Date(); return fs.is_active && new Date(fs.ends_at) >= now && new Date(fs.starts_at) <= now; }).length}</strong>
                          <small>{flashSales.length} total dibuat</small>
                        </div>
                      </div>

                      {analyticsSummary.categories.length ? (
                        analyticsSummary.categories.map((item) => (
                          <div key={item.category} className="admin-rankItem compact">
                            <div className="admin-rankCopy">
                              <strong>{item.category}</strong>
                              <small>{item.quantity} item</small>
                            </div>
                            <div className="admin-rankMeta">{formatIDR(item.revenue)}</div>
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
                            <div className="admin-rankMeta">{formatIDR(item.revenue)}</div>
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
                        <div className="admin-panel-sub">Views vs kesiapan stok.</div>
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
                          <strong>{formatIDR(analyticsSummary.pipelineValue)}</strong>
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div className="admin-rankMeta">Sisa {variant.stock}</div>
                              <button
                                className="btn btn-ghost btn-sm"
                                type="button"
                                onClick={() => {
                                  openConfirm({
                                    title: "Update stok",
                                    message: `Stok baru untuk "${variant.name}":`,
                                    prompt: true,
                                    promptDefault: String(variant.stock || 0),
                                    promptLabel: "Stok",
                                    confirmLabel: "Simpan",
                                    onConfirm: (newStock) => {
                                      const n = Number(newStock);
                                      if (!Number.isFinite(n) || n < 0) {
                                        toast.error("Stok tidak valid");
                                        return;
                                      }
                                      const tid = toast.loading("Update stok");
                                      supabase
                                        .from("product_variants")
                                        .update({ stock: n, updated_at: new Date().toISOString() })
                                        .eq("id", variant.id)
                                        .then(({ error }) => {
                                          toast.remove(tid);
                                          if (error) {
                                            toast.error("Gagal update stok");
                                            return;
                                          }
                                          toast.success(`Stok ${variant.name} → ${n}`);
                                          invalidateProductCaches();
                                          refreshProducts({ force: true });
                                        });
                                    },
                                  });
                                }}
                              >
                                Restock
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="admin-emptyInline">Belum ada stok kritis. Kondisi katalog cukup aman.</div>
                      )}
                    </div>
                  </div>

                  <div className="admin-panel">
                    <div className="admin-panel-head"><div><div className="admin-panel-title">Permintaan restock</div><div className="admin-panel-sub">Calon pembeli yang menunggu stok kembali.</div></div></div>
                    <div className="admin-panel-body admin-stack">
                      {restockRequests.length ? restockRequests.map((request) => (
                        <div className="admin-alertItem" key={request.id}>
                          <div><strong>{request.products?.name || "Produk"} · {request.product_variants?.name || "Varian"}</strong><small>{request.customer_whatsapp} · {request.notified_at ? "Sudah dikabari" : "Belum dikabari"}</small></div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <a className="btn btn-ghost btn-sm" href={`https://wa.me/${String(request.customer_whatsapp || "").replace(/\D/g, "")}`} target="_blank" rel="noreferrer">WhatsApp</a>
                            {!request.notified_at ? <button className="btn btn-sm" type="button" onClick={async () => {
                              const notifiedAt = new Date().toISOString();
                              const { error } = await supabase.from("restock_requests").update({ notified_at: notifiedAt }).eq("id", request.id);
                              if (error) return toast.error("Gagal menandai permintaan");
                              setRestockRequests((current) => current.map((item) => item.id === request.id ? { ...item, notified_at: notifiedAt } : item));
                              toast.success("Ditandai sudah dikabari");
                            }}>Tandai dikabari</button> : null}
                          </div>
                        </div>
                      )) : <div className="admin-emptyInline">Belum ada pelanggan yang meminta notifikasi restock.</div>}
                    </div>
                  </div>

                  {/* ── Panel: Visitor Analytics (dari tabel page_views) ── */}
                  <div className="admin-panel admin-panelWide">
                    <div className="admin-panel-head">
                      <div>
                        <div className="admin-panel-title">Funnel belanja</div>
                        <div className="admin-panel-sub">Konversi sesi pada {funnelSummary.days || (analyticsWindow === "30d" ? 30 : 7)} hari terakhir.</div>
                      </div>
                    </div>
                    <div className="admin-panel-body">
                      {Array.isArray(funnelSummary.steps) && funnelSummary.steps.length ? (
                        <div className="admin-miniGrid">
                          {funnelSummary.steps.map((step, index) => {
                            const labels = { view_product: "Lihat produk", add_to_cart: "Tambah keranjang", begin_checkout: "Mulai checkout", qris_opened: "QRIS terbuka", payment_reported: "Lapor bayar", order_completed: "Selesai" };
                            return <div className="admin-miniCard" key={step.event_name}>
                              <span>{labels[step.event_name] || step.event_name}</span>
                              <strong>{Number(step.sessions || 0).toLocaleString("id-ID")}</strong>
                              <small>{index === 0 ? "Sesi unik" : `${Number(step.rate_from_previous || 0).toFixed(1)}% dari tahap sebelumnya`}</small>
                            </div>;
                          })}
                        </div>
                      ) : <div className="admin-emptyInline">Funnel mulai terisi setelah migrasi checkout aktif dan pengunjung berbelanja.</div>}
                    </div>
                  </div>

                  <div className="admin-panel admin-panelWide">
                    <div className="admin-panel-head">
                      <div>
                        <div className="admin-panel-title">
                          <Users size={15} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
                          Visitor Analytics
                        </div>
                        <div className="admin-panel-sub">
                          Pengunjung baru vs. yang kembali lagi - {analyticsWindow === "30d" ? "30" : "7"} hari terakhir.
                        </div>
                      </div>
                      {analyticsLoading ? <span className="admin-panel-sub">Memuat...</span> : null}
                    </div>
                    <div className="admin-panel-body admin-stack">
                      <div className="admin-miniGrid">
                        <div className="admin-miniCard">
                          <span>Total visitor</span>
                          <strong>{visitorStats.totalVisitors.toLocaleString("id-ID")}</strong>
                          <small>Unik dalam periode</small>
                        </div>
                        <div className="admin-miniCard">
                          <span>Visitor baru</span>
                          <strong>{visitorStats.newVisitors.toLocaleString("id-ID")}</strong>
                          <small>Pertama kali berkunjung</small>
                        </div>
                        <div className="admin-miniCard">
                          <span>Balik lagi</span>
                          <strong>{visitorStats.returningVisitors.toLocaleString("id-ID")}</strong>
                          <small>Lebih dari 1 hari kunjungan</small>
                        </div>
                        <div className="admin-miniCard">
                          <span>Retention rate</span>
                          <strong>
                            {visitorStats.totalVisitors
                              ? `${((visitorStats.returningVisitors / visitorStats.totalVisitors) * 100).toFixed(1)}%`
                              : "0%"}
                          </strong>
                          <small>Visitor yang kembali</small>
                        </div>
                      </div>
                      {visitorStats.totalVisitors > 0 ? (
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <small className="muted">Baru</small>
                            <small className="muted">Kembali</small>
                          </div>
                          <div className="admin-chartTrack" style={{ height: 10, borderRadius: 6 }}>
                            <span
                              className="admin-chartBar orders"
                              style={{
                                width: `${clampPercent((visitorStats.newVisitors / visitorStats.totalVisitors) * 100)}%`,
                                borderRadius: 6,
                              }}
                            />
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                            <small>{visitorStats.newVisitors} baru</small>
                            <small>{visitorStats.returningVisitors} kembali</small>
                          </div>
                        </div>
                      ) : (
                        <div className="admin-emptyInline">
                          {analyticsLoading ? "Memuat data..." : "Belum ada data visitor. Data akan terisi setelah pengunjung datang."}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Panel: Tren Views Harian (dari daily_stats) ── */}
                  <div className="admin-panel admin-panelWide">
                    <div className="admin-panel-head">
                      <div>
                        <div className="admin-panel-title">
                          <TrendingUp size={15} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
                          Tren Views Harian
                        </div>
                        <div className="admin-panel-sub">
                          Unique views per hari dari tabel daily_stats - {analyticsWindow === "30d" ? "30" : "7"} hari terakhir.
                        </div>
                      </div>
                    </div>
                    <div className="admin-panel-body">
                      {dailyStats.length > 0 ? (() => {
                        const maxViews = Math.max(1, ...dailyStats.map((d) => d.uniqueViews));
                        const maxRev = Math.max(1, ...dailyStats.map((d) => d.revenueIdr));
                        return (
                          <div className="admin-chartList">
                            {dailyStats.map((point) => {
                              const dateLabel = new Intl.DateTimeFormat("id-ID", {
                                timeZone: "Asia/Jakarta",
                                day: "2-digit",
                                month: "short",
                              }).format(new Date(point.date + "T00:00:00+07:00"));
                              return (
                                <div key={point.date} className="admin-chartRow">
                                  <div className="admin-chartLabel">
                                    <strong>{dateLabel}</strong>
                                    <small>{point.uniqueViews} views</small>
                                  </div>
                                  <div className="admin-chartBars">
                                    <div className="admin-chartTrack">
                                      <span
                                        className="admin-chartBar orders"
                                        style={{ width: `${clampPercent((point.uniqueViews / maxViews) * 100)}%` }}
                                        title={`${point.uniqueViews} views`}
                                      />
                                    </div>
                                    <div className="admin-chartTrack">
                                      <span
                                        className="admin-chartBar revenue"
                                        style={{ width: `${clampPercent((point.revenueIdr / maxRev) * 100)}%` }}
                                        title={`Revenue: ${point.revenueIdr}`}
                                      />
                                    </div>
                                  </div>
                                  <div className="admin-chartValue">
                                    <strong>{point.totalOrders} order</strong>
                                    <small>{formatIDR(point.revenueIdr)}</small>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })() : (
                        <div className="admin-emptyInline">
                          {analyticsLoading ? "Memuat data..." : "Belum ada data di tabel daily_stats. Data akan terisi otomatis setelah ada order baru."}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Panel: Top Pages ── */}
                  <div className="admin-panel">
                    <div className="admin-panel-head">
                      <div>
                        <div className="admin-panel-title">
                          <MapPin size={15} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
                          Halaman Terpopuler
                        </div>
                        <div className="admin-panel-sub">
                          Halaman yang paling sering dikunjungi dalam {analyticsWindow === "30d" ? "30" : "7"} hari terakhir.
                        </div>
                      </div>
                    </div>
                    <div className="admin-panel-body admin-stack">
                      {topPages.length > 0 ? (() => {
                        const maxCount = Math.max(1, ...topPages.map((p) => p.viewCount));
                        return topPages.map((page, index) => (
                          <div key={page.path} className="admin-rankItem">
                            <div className="admin-rankIndex">#{index + 1}</div>
                            <div className="admin-rankCopy" style={{ flex: 1 }}>
                              <strong style={{ fontFamily: "monospace", fontSize: 13 }}>{page.path}</strong>
                              <div className="admin-chartTrack" style={{ marginTop: 4 }}>
                                <span
                                  className="admin-chartBar orders"
                                  style={{ width: `${clampPercent((page.viewCount / maxCount) * 100)}%` }}
                                />
                              </div>
                            </div>
                            <div className="admin-rankMeta">{page.viewCount.toLocaleString("id-ID")} views</div>
                          </div>
                        ));
                      })() : (
                        <div className="admin-emptyInline">
                          {analyticsLoading ? "Memuat data..." : "Belum ada data page views. Data akan terisi setelah pengunjung mulai datang."}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Panel: Conversion Rate ── */}
                  <div className="admin-panel">
                    <div className="admin-panel-head">
                      <div>
                        <div className="admin-panel-title">Conversion Rate</div>
                        <div className="admin-panel-sub">Persentase visitor yang melakukan order.</div>
                      </div>
                    </div>
                    <div className="admin-panel-body admin-stack">
                      <div className="admin-miniGrid">
                        <div className="admin-miniCard">
                          <span>Konversi keseluruhan</span>
                          <strong>
                            {storePulse.total_views
                              ? `${calcConversionRate(orders.length, storePulse.total_views).toFixed(2)}%`
                              : "-"}
                          </strong>
                          <small>{orders.length} order dari {storePulse.total_views} views</small>
                        </div>
                        <div className="admin-miniCard">
                          <span>Konversi hari ini</span>
                          <strong>
                            {storePulse.today_views
                              ? `${calcConversionRate(storePulse.today_orders || analyticsSummary.todayOrders, storePulse.today_views).toFixed(2)}%`
                              : "-"}
                          </strong>
                          <small>{storePulse.today_views} views hari ini</small>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Panel: Cohort Return ── */}
                  <div className="admin-panel">
                    <div className="admin-panel-head">
                      <div>
                        <div className="admin-panel-title">Visitor Kembali (Cohort 7 Hari)</div>
                        <div className="admin-panel-sub">Visitor unik yang kembali dalam 7 hari setelah kunjungan pertama.</div>
                      </div>
                    </div>
                    <div className="admin-panel-body admin-stack">
                      {(() => {
                        const display = formatCohortDisplay(cohortReturn, visitorStats.totalVisitors);
                        return (
                          <div className="admin-miniGrid">
                            <div className="admin-miniCard">
                              <span>Visitor kembali</span>
                              <strong>{display.value.toLocaleString("id-ID")}</strong>
                              <small>
                                {display.percent != null
                                  ? `${display.percent.toFixed(1)}% dari total visitor`
                                  : "Belum ada data visitor"}
                              </small>
                            </div>
                            <div className="admin-miniCard">
                              <span>Total visitor unik</span>
                              <strong>{visitorStats.totalVisitors.toLocaleString("id-ID")}</strong>
                              <small>Dalam {analyticsWindow === "30d" ? "30" : "7"} hari terakhir</small>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* ── Panel: Revenue Forecast ── */}
                  <div className="admin-panel">
                    <div className="admin-panel-head">
                      <div>
                        <div className="admin-panel-title">Revenue Forecast 7 Hari</div>
                        <div className="admin-panel-sub">Proyeksi revenue berdasarkan tren 30 hari terakhir (regresi linear).</div>
                      </div>
                    </div>
                    <div className="admin-panel-body admin-stack">
                      {(() => {
                        const forecast = calcRevenueForecast(dailyStats);
                        if (!forecast) {
                          return (
                            <div className="admin-emptyInline">
                              {analyticsLoading ? "Memuat data..." : "Data tidak cukup untuk forecast (butuh minimal 7 hari data)."}
                            </div>
                          );
                        }
                        const trendIcon = forecast.trend === "up" ? "↑" : forecast.trend === "down" ? "↓" : "→";
                        const trendLabel = forecast.trend === "up" ? "Tren naik" : forecast.trend === "down" ? "Tren turun" : "Stabil";
                        return (
                          <div className="admin-miniGrid">
                            <div className="admin-miniCard">
                              <span>Proyeksi 7 hari ke depan</span>
                              <strong>{formatIDR(forecast.forecast7d)}</strong>
                              <small>{trendIcon} {trendLabel}</small>
                            </div>
                            <div className="admin-miniCard">
                              <span>Rata-rata per hari (forecast)</span>
                              <strong>{formatIDR(Math.round(forecast.forecast7d / 7))}</strong>
                              <small>Berdasarkan {dailyStats.length} hari data</small>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {tab === "products" ? (
              <div className={`admin-products admin-workspacePane${selectedProductId ? " has-selection" : ""}`}>
                <div className="admin-panel admin-products-list">
                  <div className="admin-panel-head">
                    <div>
                      <div className="admin-panel-title">Katalog</div>
                      <div className="admin-panel-sub">Pilih produk untuk edit</div>
                    </div>
                    <button className="btn btn-sm btn-primary" onClick={openCreateProduct}>
                      <Plus size={14} /> Produk
                    </button>
                  </div>

                  <div className="admin-panel-body admin-panel-body--scroll">
                    <div className="admin-stickyTools">
                      <input
                        className="input"
                        placeholder="Cari produk..."
                        value={productQuery}
                        onChange={(e) => setProductQuery(e.target.value)}
                      />
                      <div className="admin-inlineStats" aria-label="Ringkas katalog">
                        <span><strong>{products.length}</strong> produk</span>
                        <span><strong>{allVariants.length}</strong> varian</span>
                        {lowStockProductIds.size > 0 ? (
                          <button
                            type="button"
                            className={`admin-inlineStatChip is-warn${productStockFilter === "low" ? " is-active" : ""}`}
                            onClick={() => {
                              if (productStockFilter === "low") {
                                setProductStockFilter("all");
                              } else {
                                openLowStockProducts();
                              }
                            }}
                          >
                            <strong>{lowStockProductIds.size}</strong> stok tipis
                          </button>
                        ) : null}
                      </div>
                      {productStockFilter === "low" ? (
                        <div className="admin-filterBanner is-warn" role="status">
                          <span>Menampilkan produk stok tipis (sisa 1, bukan kosong)</span>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setProductStockFilter("all")}>
                            Tampilkan semua
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <div className="admin-list admin-list--dense">
                      {(filteredProducts || []).length === 0 ? (
                        <div className="admin-emptyInline" style={{ padding: "18px 8px" }}>
                          {productStockFilter === "low"
                            ? "Tidak ada produk dengan stok tipis."
                            : "Belum ada produk."}
                        </div>
                      ) : null}
                      {(filteredProducts || []).slice(0, visibleProductsCount).map((p) => {
                        const thinCount = (p.product_variants || []).filter(
                          (v) => v?.is_active && isThinStock(v?.stock)
                        ).length;
                        return (
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
                              <div className="admin-product-sub">
                                {prettyCategory(p.category)}
                                {thinCount > 0 ? ` · ${thinCount} varian tipis` : ""}
                              </div>
                            </div>
                          </div>

                          <div className={"admin-product-pill " + (p.is_active ? "on" : "off")}
                            title={p.is_active ? "Aktif" : "Nonaktif"}
                          >
                            {thinCount > 0 ? "Tipis" : p.is_active ? "Aktif" : "Off"}
                          </div>
                        </button>
                        );
                      })}

                      {visibleProductsCount < filteredProducts.length && (
                        <div className="admin-loadMore" style={{ textAlign: "center", marginTop: 14 }}>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => setVisibleProductsCount((prev) => prev + 20)}
                          >
                            Muat Lebih Banyak
                          </button>
                        </div>
                      )}

                      {filteredProducts.length === 0 ? (
                        <div className="card pad" style={{ marginTop: 10 }}>
                          <EmptyState icon="?" title="Tidak ada" description="Produk tidak ditemukan." />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="admin-panel admin-products-editor">
                  {!selectedProduct || !productForm ? (
                    <div className="admin-panel-body admin-panel-body--scroll admin-products-editorEmpty">
                      <EmptyState
                        icon="?"
                        title="Pilih produk"
                        description="Ketuk produk di daftar untuk mengedit."
                      />
                    </div>
                  ) : (
                    <>
                      <div className="admin-productsEditorChrome">
                        <button
                          type="button"
                          className="admin-mobileBack"
                          onClick={() => setSelectedProductId("")}
                          aria-label="Kembali ke daftar produk"
                        >
                          <ArrowLeft size={16} strokeWidth={2.25} aria-hidden="true" />
                          <span>Kembali</span>
                        </button>
                        <div className="admin-panel-head admin-panel-head--split admin-productsEditorHead">
                          <div className="admin-panel-headMain">
                            <div className="admin-panel-title">{selectedProduct.name || "Detail Produk"}</div>
                            <div className="admin-panel-sub">Edit info + paket</div>
                          </div>
                          <div className="admin-head-actions admin-panel-headActions">
                            <a className="btn btn-ghost btn-sm" href={`/produk/${selectedProduct.slug}`} target="_blank" rel="noreferrer">
                              Preview
                            </a>
                            <button className="btn btn-danger btn-sm" type="button" onClick={() => deleteProduct(selectedProduct.id)}>
                              Hapus
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="admin-panel-body admin-panel-body--scroll">
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
                              placeholder="Deskripsi singkat untuk halaman detail"
                            />
                          </label>

                          <label className="admin-field">
                            <span>Urutan tampil</span>
                            <input
                              className="input"
                              type="number"
                              value={productForm.sort_order}
                              onChange={(e) =>
                                setProductForm((p) => ({ ...p, sort_order: Number(e.target.value) }))
                              }
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
                              // Batalkan edit: kembalikan form ke data tersimpan
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
                            title="Buang perubahan yang belum disimpan"
                          >
                            Batalkan edit
                          </button>
                          <button className="btn" type="button" onClick={saveProduct}>
                            Simpan Produk
                          </button>
                        </div>

                        <div className="divider" style={{ margin: "18px 0" }} />

                        <div className="admin-panel-head" style={{ padding: 0, marginBottom: 10 }}>
                          <div>
                            <div className="admin-panel-title">Paket harga</div>
                            <div className="admin-panel-sub">
                              Tambah paket: nama, harga, stok, durasi, garansi, dan opsi email.
                            </div>
                          </div>

                          <button className="btn btn-sm" onClick={openCreateVariant}>
                            + Paket
                          </button>
                        </div>

                        <div className="admin-variants">
                          {selectedVariants.length === 0 ? (
                            <div className="card pad">
                              <EmptyState icon="?" title="Belum ada paket" description="Klik + Paket untuk menambahkan harga." />
                            </div>
                          ) : (
                            selectedVariants.map((v) => (
                              <div key={v.id} className="admin-variant-row">
                                <div className="admin-variant-main">
                                  <div className="admin-variant-title">{v.name}</div>
                                  <div className="admin-variant-sub">
                                    {v.duration_label} | <b>{formatIDR(v.price_idr)}</b> | stok <b>{v.stock}</b>
                                    {!v.is_active ? " | (off)" : ""}
                                    {v.requires_buyer_email ? " | wajib email buyer" : ""}
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
              <div className="admin-panel admin-panel--fill admin-ordersPanel admin-workspacePane">
                <div className="admin-panel-head admin-panel-head--split admin-ordersHead">
                  <div>
                    <div className="admin-panel-title">Pesanan</div>
                    <div className="admin-panel-sub">
                      {orderBucket === "attention"
                        ? `${orderStats.live} perlu aksi (semua di database)`
                        : `${filteredOrders.length} di halaman ini · ${orderStats.total} total di database`}
                    </div>
                  </div>
                  <div className="admin-panel-headActions">
                    <button className="btn btn-ghost btn-sm" onClick={refreshOrders} type="button">
                      Refresh
                    </button>
                    <button className="btn btn-sm btn-primary admin-desktopOnly" type="button" onClick={handleExportCSV}>
                      Export
                    </button>
                  </div>
                </div>

                <div className="admin-panel-body admin-panel-body--scroll admin-ordersBody">
                  <div className="admin-orderToolbar admin-orderToolbar--sticky">
                    <input
                      className="input"
                      type="search"
                      value={orderQuery}
                      onChange={(e) => setOrderQuery(e.target.value)}
                      placeholder="Cari kode / WA / produk..."
                      autoComplete="off"
                    />

                    <div className="admin-orderFilterBar" aria-label="Filter order">
                      <div className="admin-chipRow admin-chipRow--scroll" role="tablist" aria-label="Katalog pesanan">
                        <button
                          type="button"
                          className={`admin-chip ${orderCatalogFilter === "all" ? "active" : ""}`}
                          onClick={() => {
                            setOrderCatalogFilter("all");
                            setOrderBucket("all");
                            setOrderStatusFilterOpen(false);
                          }}
                        >
                          Semua
                        </button>
                        <button
                          type="button"
                          className={`admin-chip ${orderCatalogFilter === "app_premium" ? "active" : ""}`}
                          onClick={() => {
                            setOrderCatalogFilter((prev) => (prev === "app_premium" ? "all" : "app_premium"));
                          }}
                        >
                          App premium
                        </button>
                        <button
                          type="button"
                          className={`admin-chip ${orderCatalogFilter === "academic" ? "active" : ""}`}
                          onClick={() => {
                            setOrderCatalogFilter((prev) => (prev === "academic" ? "all" : "academic"));
                          }}
                        >
                          Jasa Akademik
                        </button>
                        <button
                          type="button"
                          className={`admin-chip admin-chip--filter${orderStatusFilterOpen || orderBucket !== "all" ? " active" : ""}`}
                          aria-expanded={orderStatusFilterOpen}
                          onClick={() => setOrderStatusFilterOpen((v) => !v)}
                        >
                          <Filter size={14} />
                          Filter
                          {orderBucket !== "all" ? (
                            <span className="admin-chipMeta">
                              {orderBucket === "attention"
                                ? "Aksi"
                                : orderBucket === "done"
                                  ? "Selesai"
                                  : orderBucket === "cancelled"
                                    ? "Batal"
                                    : ""}
                            </span>
                          ) : null}
                        </button>
                      </div>

                      {orderStatusFilterOpen ? (
                        <div className="admin-orderStatusMenu" role="group" aria-label="Filter status">
                          <button
                            type="button"
                            className={`admin-chip ${orderBucket === "attention" ? "active" : ""}`}
                            onClick={() => setOrderBucket("attention")}
                          >
                            Aksi {orderStats.live > 0 ? `(${orderStats.live})` : ""}
                          </button>
                          <button
                            type="button"
                            className={`admin-chip ${orderBucket === "done" ? "active" : ""}`}
                            onClick={() => setOrderBucket("done")}
                          >
                            Selesai
                          </button>
                          <button
                            type="button"
                            className={`admin-chip ${orderBucket === "cancelled" ? "active" : ""}`}
                            onClick={() => setOrderBucket("cancelled")}
                          >
                            Batal
                          </button>
                          {orderBucket !== "all" ? (
                            <button
                              type="button"
                              className="admin-chip"
                              onClick={() => {
                                setOrderBucket("all");
                                setOrderStatusFilterOpen(false);
                              }}
                            >
                              Reset status
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="admin-inlineStats admin-orderQuickStats">
                      <span>
                        <strong>{new Intl.NumberFormat("id-ID").format(orderStats.total)}</strong> total
                      </span>
                      <span className="is-warn">
                        <strong>{new Intl.NumberFormat("id-ID").format(orderStats.live)}</strong> aksi
                      </span>
                      <span>
                        <strong>{new Intl.NumberFormat("id-ID").format(orderStats.done)}</strong> selesai
                      </span>
                    </div>

                    <button
                      type="button"
                      className="admin-toolsToggle"
                      aria-expanded={orderToolsOpen}
                      onClick={() => setOrderToolsOpen((v) => !v)}
                    >
                      {orderToolsOpen ? "Sembunyikan export" : "Export & rentang tanggal"}
                    </button>

                    <div className={`admin-orderToolsExtra${orderToolsOpen ? " is-open" : ""}`}>
                      <div className="admin-exportDates">
                        <label>
                          <span>Dari</span>
                          <input
                            className="input"
                            type="date"
                            value={exportDateFrom}
                            onChange={(e) => setExportDateFrom(e.target.value)}
                          />
                        </label>
                        <label>
                          <span>Sampai</span>
                          <input
                            className="input"
                            type="date"
                            value={exportDateTo}
                            onChange={(e) => setExportDateTo(e.target.value)}
                          />
                        </label>
                      </div>
                      <button className="btn btn-sm btn-primary" type="button" onClick={handleExportCSV}>
                        Export CSV
                      </button>
                    </div>
                  </div>

                  {filteredOrders.length === 0 ? (
                    <div className="admin-emptyWrap">
                      <EmptyState
                        icon="ORD"
                        title={orderBucket === "attention" ? "Tidak ada order yang perlu aksi" : "Order tidak ditemukan"}
                        description={
                          orderBucket === "attention"
                            ? "Semua antrean bersih. Buka filter Semua untuk melihat riwayat."
                            : "Coba ubah filter atau kata kunci."
                        }
                        primaryAction={
                          orderBucket === "attention"
                            ? { label: "Lihat semua order", onClick: () => setOrderBucket("all") }
                            : undefined
                        }
                      />
                    </div>
                  ) : (
                    <>
                      {selectedOrderIds.size > 0 ? (
                        <div className="admin-bulkBar admin-bulkBar--sticky">
                          <span className="admin-bulkCount">{selectedOrderIds.size} dipilih</span>
                          <div className="admin-bulkActions">
                            <button className="btn btn-sm" type="button" onClick={() => bulkUpdateStatus("done")}>
                              Selesai
                            </button>
                            <button className="btn btn-danger btn-sm" type="button" onClick={() => bulkUpdateStatus("cancelled")}>
                              Batal
                            </button>
                            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setSelectedOrderIds(new Set())}>
                              Clear
                            </button>
                          </div>
                        </div>
                      ) : null}

                      <div className="admin-bulkSelectAll">
                        <label className="admin-checkLabel">
                          <input
                            type="checkbox"
                            checked={filteredOrders.length > 0 && filteredOrders.every((o) => selectedOrderIds.has(o.id))}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedOrderIds(new Set(filteredOrders.map((o) => o.id)));
                              } else {
                                setSelectedOrderIds(new Set());
                              }
                            }}
                          />
                          Pilih semua ({filteredOrders.length})
                        </label>
                      </div>

                      <VirtualList
                        className="admin-ordersList admin-ordersList--dense admin-ordersList--virtual"
                        items={filteredOrders}
                        estimateHeight={96}
                        overscan={6}
                        style={{ maxHeight: "min(70vh, 720px)" }}
                        getKey={(o) => o.id}
                        renderItem={(o) => (
                          <AdminOrderListItem
                            order={o}
                            isSelected={selectedOrderIds.has(o.id)}
                            onToggleSelect={(id, checked) => {
                              setSelectedOrderIds((prev) => {
                                const next = new Set(prev);
                                if (checked) next.add(id);
                                else next.delete(id);
                                return next;
                              });
                            }}
                            onStatusChange={requestOrderStatusChange}
                            onOpenDetail={setActiveOrderId}
                            onCopyStatusLink={copyStatusLink}
                          />
                        )}
                      />

                      {ordersHasMore ? (
                        <div className="admin-capBanner" role="status">
                          Menampilkan {orders.length} order terbaru. Masih ada order lebih lama di database.
                        </div>
                      ) : null}

                      <div className="admin-loadMore">
                        {ordersHasMore ? (
                          <button
                            className="btn btn-ghost"
                            type="button"
                            disabled={ordersLoadingMore}
                            onClick={loadMoreOrders}
                          >
                            {ordersLoadingMore ? "Memuat..." : `Muat ${ORDERS_PAGE_SIZE} order lama`}
                          </button>
                        ) : null}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : null}

            {tab === "promos" ? (
              <div className="admin-panel admin-panel--fill admin-promosPanel admin-workspacePane">
                <div className="admin-panel-head admin-panel-head--split">
                  <div>
                    <div className="admin-panel-title">Promo</div>
                    <div className="admin-panel-sub">
                      {promos.filter((p) => p.is_active && !isPromoExpired(p)).length} aktif
                    </div>
                  </div>
                  <div className="admin-panel-headActions">
                    <button className="btn btn-primary" type="button" onClick={openCreatePromo}>
                      <Plus size={15} strokeWidth={2.5} />
                      Buat
                    </button>
                  </div>
                </div>

                <div className="admin-panel-body admin-panel-body--scroll">
                  <div className="admin-stickyTools">
                    <div className="admin-promo-search">
                      <Search size={14} className="admin-promo-searchIcon" />
                      <input
                        className="input admin-promo-searchInput"
                        placeholder="Cari kode promo..."
                        value={promoQuery}
                        onChange={(e) => setPromoQuery(e.target.value)}
                      />
                    </div>
                    <div className="admin-inlineStats">
                      <span><strong>{promos.filter((p) => p.is_active && !isPromoExpired(p)).length}</strong> aktif</span>
                      <span><strong>{promos.filter((p) => isPromoExpired(p)).length}</strong> expired</span>
                      <span><strong>{promos.filter((p) => !p.is_active).length}</strong> off</span>
                      <span><strong>{promos.reduce((s, p) => s + (p.used_count || 0), 0)}</strong> pakai</span>
                    </div>
                  </div>

                  {/* Bulk import */}
                  <details className="admin-promo-bulk">
                    <summary className="admin-promo-bulkToggle">
                      <Tags size={14} />
                      <span>Import massal</span>
                      <span className="admin-promo-bulkHint">Format: KODE,persen - satu per baris</span>
                    </summary>
                    <div className="admin-promo-bulkBody">
                      <textarea
                        className="input admin-promo-bulkInput"
                        rows={4}
                        placeholder={"DISNEY10,10\nNETFLIX20,20\nGRATIS100,100"}
                        value={promoBulk}
                        onChange={(e) => setPromoBulk(e.target.value)}
                        spellCheck={false}
                      />
                      <div className="admin-promo-bulkActions">
                        <button
                          className="btn btn-sm"
                          type="button"
                          onClick={addPromoBulk}
                          disabled={!promoBulk.trim()}
                        >
                          <Plus size={13} strokeWidth={2.5} />
                          Simpan semua
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          type="button"
                          onClick={() => setPromoBulk("")}
                          disabled={!promoBulk.trim()}
                        >
                          Bersihkan
                        </button>
                      </div>
                      <p className="admin-promo-bulkNote">
                        Kode yang sudah ada akan di-update (upsert). Kode baru akan dibuat otomatis.
                      </p>
                    </div>
                  </details>

                  {/* Promo cards */}
                  {promos.length === 0 ? (
                    <div className="admin-emptyInline">Belum ada kode promo. Klik "Buat Promo" untuk mulai.</div>
                  ) : (
                    <div className="admin-promo-grid">
                      {promos
                        .filter((p) => {
                          if (!promoQuery.trim()) return true;
                          return p.code.toLowerCase().includes(promoQuery.trim().toLowerCase());
                        })
                        .map((p) => {
                          const expired = isPromoExpired(p);
                          const usedPct = p.max_uses ? Math.min(100, ((p.used_count || 0) / p.max_uses) * 100) : 0;
                          const statusLabel = expired ? "Kedaluwarsa" : p.is_active ? "Aktif" : "Nonaktif";
                          const statusClass = expired ? "expired" : p.is_active ? "active" : "off";
                          return (
                            <div key={p.code} className={`admin-promo-card ${expired ? "is-expired" : ""} ${!p.is_active ? "is-off" : ""}`}>
                              {/* Top row: code + status */}
                              <div className="admin-promo-cardTop">
                                <div className="admin-promo-cardLeft">
                                  <div className="admin-promo-cardCode">
                                    <span>{p.code}</span>
                                    <button
                                      className="admin-promo-copyBtn"
                                      type="button"
                                      title="Salin kode"
                                      onClick={() => copyPromoCode(p.code)}
                                    >
                                      {copiedCode === p.code ? <Check size={12} /> : <Copy size={12} />}
                                    </button>
                                  </div>
                                  <span className={`admin-promoBadge ${statusClass}`}>{statusLabel}</span>
                                </div>
                                <div className="admin-promo-cardDiscount">{p.percent}%</div>
                              </div>

                              {/* Meta row */}
                              <div className="admin-promo-cardMeta">
                                {p.expired_at ? (
                                  <span className={expired ? "admin-promo-metaWarn" : ""}>
                                    Exp: {new Date(p.expired_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                                  </span>
                                ) : (
                                  <span className="admin-promo-metaMuted">Tanpa batas waktu</span>
                                )}
                                {p.max_uses != null ? (
                                  <span>{p.used_count || 0}/{p.max_uses} dipakai</span>
                                ) : (
                                  <span className="admin-promo-metaMuted">Kuota tak terbatas</span>
                                )}
                              </div>

                              {/* Quota progress bar */}
                              {p.max_uses != null && (
                                <div className="admin-promo-quotaTrack">
                                  <div
                                    className={`admin-promo-quotaBar ${usedPct >= 90 ? "is-full" : ""}`}
                                    style={{ width: `${usedPct}%` }}
                                  />
                                </div>
                              )}

                              {/* Actions */}
                              {(() => {
                                const showOnHome = (settings?.home_promos?.codes || []).includes(p.code);
                                return (
                                  <div className="admin-promo-cardActions">
                                    <button
                                      className="btn btn-sm btn-ghost admin-promo-editBtn"
                                      type="button"
                                      onClick={() => openEditPromo(p)}
                                    >
                                      <Pencil size={13} />
                                      Edit
                                    </button>
                                    <button
                                      className={"btn btn-sm " + (p.is_active ? "btn-ghost" : "")}
                                      type="button"
                                      onClick={() => togglePromo(p.code, !p.is_active)}
                                    >
                                      {p.is_active ? "Nonaktifkan" : "Aktifkan"}
                                    </button>
                                    <button
                                      className={"btn btn-sm " + (showOnHome ? "btn-primary" : "btn-ghost")}
                                      type="button"
                                      onClick={() => toggleHomePromo(p.code)}
                                      title={showOnHome ? "Sembunyikan kupon dari beranda dan label atas" : "Tampilkan kupon di beranda dan label atas"}
                                    >
                                      {showOnHome ? "Tampil di Home" : "Set ke Home"}
                                    </button>
                                    <button
                                      className="btn btn-sm btn-danger"
                                      type="button"
                                      onClick={() => deletePromo(p.code)}
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                );
                              })()}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {/* Promo Form Modal */}
            {promoFormOpen && createPortal(
              <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setPromoFormOpen(false); }}>
                <div className="modal" style={{ maxWidth: 440 }}>
                  <div className="modal-head">
                    <div className="modal-title">{promoFormMode === "edit" ? "Edit Promo" : "Buat Promo Baru"}</div>
                    <button className="modal-close" type="button" onClick={() => setPromoFormOpen(false)}>
                      <X size={16} />
                    </button>
                  </div>
                  <div className="modal-body">
                    <div className="admin-form-grid">
                      <label className="admin-field admin-field-full">
                        <span>Kode Promo *</span>
                        <input
                          className="input"
                          placeholder="Contoh: HEMAT20"
                          value={promoForm.code}
                          disabled={promoFormMode === "edit"}
                          onChange={(e) => setPromoForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                          style={{ textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 900 }}
                        />
                      </label>
                      <label className="admin-field">
                        <span>Diskon (%) *</span>
                        <input
                          className="input"
                          type="number"
                          min={1}
                          max={100}
                          placeholder="Contoh: 20"
                          value={promoForm.percent}
                          onChange={(e) => setPromoForm((f) => ({ ...f, percent: e.target.value }))}
                        />
                      </label>
                      <label className="admin-field">
                        <span>Kuota maks (opsional)</span>
                        <input
                          className="input"
                          type="number"
                          min={1}
                          placeholder="Kosong = tak terbatas"
                          value={promoForm.max_uses}
                          onChange={(e) => setPromoForm((f) => ({ ...f, max_uses: e.target.value }))}
                        />
                      </label>
                      <label className="admin-field admin-field-full">
                        <span>Tanggal kedaluwarsa (opsional)</span>
                        <input
                          className="input"
                          type="date"
                          value={promoForm.expired_at}
                          onChange={(e) => setPromoForm((f) => ({ ...f, expired_at: e.target.value }))}
                        />
                      </label>
                    </div>
                    {promoForm.code && promoForm.percent && (
                      <div className="admin-promo-preview">
                        <span className="admin-promo-previewLabel">Preview</span>
                        <div className="admin-promo-previewCode">{promoForm.code}</div>
                        <div className="admin-promo-previewMeta">
                          Diskon {promoForm.percent}%
                          {promoForm.expired_at ? ` · Exp ${new Date(promoForm.expired_at + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                          {promoForm.max_uses ? ` · Kuota ${promoForm.max_uses}` : ""}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="modal-foot">
                    <div className="modal-actions">
                      <button className="btn btn-ghost" type="button" onClick={() => setPromoFormOpen(false)}>Batal</button>
                      <button className="btn" type="button" onClick={savePromoForm}>
                        {promoFormMode === "edit" ? "Simpan Perubahan" : "Buat Promo"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>,
              document.body
            )}

            {/* Delete Promo Confirm Modal */}
            {promoDeleteTarget && createPortal(
              <div
                className="modal-backdrop"
                onClick={(e) => { if (e.target === e.currentTarget) setPromoDeleteTarget(null); }}
              >
                <div className="modal admin-promo-deleteModal">
                  <div className="modal-head">
                    <div className="modal-title">Hapus Promo?</div>
                    <button className="modal-close" type="button" onClick={() => setPromoDeleteTarget(null)}>
                      <X size={16} />
                    </button>
                  </div>
                  <div className="modal-body">
                    <div className="admin-promo-deleteBody">
                      <div className="admin-promo-deleteIcon">
                        <Trash2 size={22} />
                      </div>
                      <div>
                        <p className="admin-promo-deleteText">
                          Kode promo <strong>{promoDeleteTarget}</strong> akan dihapus permanen.
                          Tindakan ini tidak bisa dibatalkan.
                        </p>
                        <p className="admin-promo-deleteHint">
                          Order yang sudah memakai kode ini tidak terpengaruh.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="modal-foot">
                    <div className="modal-actions">
                      <button className="btn btn-ghost" type="button" onClick={() => setPromoDeleteTarget(null)}>
                        Batal
                      </button>
                      <button className="btn btn-danger" type="button" onClick={confirmDeletePromo}>
                        <Trash2 size={14} />
                        Ya, Hapus
                      </button>
                    </div>
                  </div>
                </div>
              </div>,
              document.body
            )}

            {tab === "flashsale" ? (
              <div className="admin-panel admin-panel--fill admin-flashsalePanel admin-workspacePane">
                <div className="admin-panel-head admin-panel-head--split">
                  <div>
                    <div className="admin-panel-title">Flash sale</div>
                    <div className="admin-panel-sub">{liveFlashCount} live sekarang</div>
                  </div>
                  <div className="admin-panel-headActions">
                    <button className="btn btn-sm btn-primary" type="button" onClick={() => setFlashFormOpen(true)}>
                      <Plus size={14} /> Buat
                    </button>
                  </div>
                </div>

                <div className="admin-panel-body admin-panel-body--scroll">
                  {flashFormOpen ? (
                    <div className="admin-promo-card" style={{ marginBottom: 16, padding: 16 }}>
                      <div className="admin-panel-title" style={{ fontSize: 14, marginBottom: 12 }}>
                        {flashForm.id ? "Edit Flash Sale" : "Buat Flash Sale Baru"}
                      </div>
                      <div className="admin-form-grid">
                        <label className="admin-field admin-field-full">
                          <span>Varian (pilih dari daftar)</span>
                          <select
                            className="input"
                            value={flashForm.variant_id}
                            onChange={(e) => setFlashForm((f) => ({ ...f, variant_id: e.target.value }))}
                          >
                            <option value="">-- Pilih varian --</option>
                            {(products || []).map((p) =>
                              (p.product_variants || []).filter((v) => v.is_active).map((v) => (
                                <option key={v.id} value={v.id}>
                                  {p.name} - {v.name} ({formatIDR(v.price_idr)})
                                </option>
                              ))
                            )}
                          </select>
                        </label>
                        <label className="admin-field">
                          <span>Diskon (%)</span>
                          <input
                            className="input"
                            type="number"
                            min="1"
                            max="99"
                            placeholder="10"
                            value={flashForm.discount_percent}
                            onChange={(e) => setFlashForm((f) => ({ ...f, discount_percent: e.target.value }))}
                          />
                        </label>
                        <label className="admin-field">
                          <span>Mulai</span>
                          <input
                            className="input"
                            type="datetime-local"
                            value={flashForm.starts_at}
                            onChange={(e) => setFlashForm((f) => ({ ...f, starts_at: e.target.value }))}
                          />
                        </label>
                        <label className="admin-field">
                          <span>Berakhir</span>
                          <input
                            className="input"
                            type="datetime-local"
                            value={flashForm.ends_at}
                            onChange={(e) => setFlashForm((f) => ({ ...f, ends_at: e.target.value }))}
                          />
                        </label>
                      </div>
                      {flashForm.variant_id && flashForm.discount_percent ? (() => {
                        const v = allVariants.find(x => x.id === flashForm.variant_id);
                        if (!v) return null;
                        const discounted = Math.round(v.price_idr * (1 - Number(flashForm.discount_percent) / 100));
                        return (
                          <div className="admin-promo-preview" style={{ marginTop: 8 }}>
                            <span className="admin-promo-previewLabel">Preview harga</span>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                              <span style={{ textDecoration: 'line-through', color: 'var(--brand-muted)', fontSize: 13 }}>{formatIDR(v.price_idr)}</span>
                              <span className="admin-promo-previewPrice">{formatIDR(discounted)}</span>
                              <span style={{ fontSize: 11, color: 'var(--brand-muted)' }}>(-{flashForm.discount_percent}%)</span>
                            </div>
                          </div>
                        );
                      })() : null}
                      <div className="admin-form-actions" style={{ marginTop: 12 }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          type="button"
                          onClick={() => {
                            setFlashFormOpen(false);
                            setFlashForm({ variant_id: "", discount_percent: "", starts_at: "", ends_at: "" });
                          }}
                        >
                          Batal
                        </button>
                        <button
                          className="btn btn-sm"
                          type="button"
                          onClick={async () => {
                            if (!flashForm.variant_id || !flashForm.discount_percent || !flashForm.starts_at || !flashForm.ends_at) {
                              toast.error("Lengkapi semua field");
                              return;
                            }
                            const disc = Math.floor(Number(flashForm.discount_percent));
                            if (!Number.isFinite(disc) || disc < 1 || disc > 99) {
                              toast.error("Diskon flash sale harus antara 1% – 99%");
                              return;
                            }
                            if (new Date(flashForm.ends_at) <= new Date(flashForm.starts_at)) {
                              toast.error("Tanggal selesai harus setelah tanggal mulai");
                              return;
                            }
                            const tid = toast.loading("Menyimpan flash sale");
                            try {
                              if (flashForm.id) {
                                await updateFlashSale(flashForm.id, {
                                  variant_id: flashForm.variant_id,
                                  discount_percent: disc,
                                  starts_at: new Date(flashForm.starts_at).toISOString(),
                                  ends_at: new Date(flashForm.ends_at).toISOString(),
                                });
                              } else {
                                await createFlashSale({
                                  variant_id: flashForm.variant_id,
                                  discount_percent: disc,
                                  starts_at: new Date(flashForm.starts_at).toISOString(),
                                  ends_at: new Date(flashForm.ends_at).toISOString(),
                                });
                              }
                              setFlashSales(await fetchAllFlashSales());
                              setFlashFormOpen(false);
                              setFlashForm({ variant_id: "", discount_percent: "", starts_at: "", ends_at: "" });
                              toast.remove(tid);
                              toast.success("Flash sale disimpan");
                            } catch (e) {
                              toast.remove(tid);
                              toast.error(e?.message || "Gagal simpan flash sale");
                            }
                          }}
                        >
                          Simpan
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {flashSales.length === 0 ? (
                    <div className="admin-emptyInline">Belum ada flash sale. Klik "Buat Flash Sale" untuk mulai.</div>
                  ) : (
                    <div className="admin-promo-grid">
                      {flashSales.map((fs) => {
                        const now = new Date();
                        const isExpired = new Date(fs.ends_at) < now;
                        const isUpcoming = new Date(fs.starts_at) > now;
                        const isLive = !isExpired && !isUpcoming && fs.is_active;
                        const variant = allVariants.find((v) => v.id === fs.variant_id);
                        const product = (products || []).find((p) =>
                          (p.product_variants || []).some((v) => v.id === fs.variant_id)
                        );

                        return (
                          <div key={fs.id} className={`admin-promo-card ${isExpired ? "is-expired" : ""}`}>
                            <div className="admin-promo-cardTop">
                              <div className="admin-promo-cardLeft">
                                <div className="admin-promo-cardCode">
                                  <span>{product?.name || "?"} - {variant?.name || fs.variant_id.slice(0, 8)}</span>
                                </div>
                                <span className={`admin-promoBadge ${isLive ? "active" : isExpired ? "expired" : "off"}`}>
                                  {isLive ? "Live" : isExpired ? "Berakhir" : isUpcoming ? "Akan datang" : "Nonaktif"}
                                </span>
                              </div>
                              <div className="admin-promo-cardDiscount">{fs.discount_percent}%</div>
                            </div>

                            <div className="admin-promo-cardMeta">
                              <span>Mulai: {new Date(fs.starts_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                              <span>Akhir: {new Date(fs.ends_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                            </div>

                            <div className="admin-promo-cardActions">
                              <button
                                className="btn btn-sm btn-ghost"
                                type="button"
                                onClick={() => {
                                  setFlashForm({
                                    id: fs.id,
                                    variant_id: fs.variant_id,
                                    discount_percent: String(fs.discount_percent),
                                    starts_at: toLocalDatetimeInput(fs.starts_at),
                                    ends_at: toLocalDatetimeInput(fs.ends_at),
                                  });
                                  setFlashFormOpen(true);
                                }}
                              >
                                Edit
                              </button>
                              <button
                                className="btn btn-sm btn-danger"
                                type="button"
                                onClick={() => {
                                  openConfirm({
                                    title: "Hapus flash sale",
                                    message: "Hapus flash sale ini?",
                                    confirmLabel: "Ya, hapus",
                                    danger: true,
                                    onConfirm: async () => {
                                      const tid = toast.loading("Menghapus");
                                      try {
                                        await deleteFlashSale(fs.id);
                                        setFlashSales(await fetchAllFlashSales());
                                        toast.remove(tid);
                                        toast.success("Dihapus");
                                      } catch (e) {
                                        toast.remove(tid);
                                        toast.error("Gagal hapus");
                                      }
                                    },
                                  });
                                }}
                              >
                                Hapus
                              </button>
                              <button
                                className="btn btn-sm btn-ghost"
                                type="button"
                                onClick={async () => {
                                  const tid = toast.loading("Update");
                                  try {
                                    await updateFlashSale(fs.id, { is_active: !fs.is_active });
                                    setFlashSales(await fetchAllFlashSales());
                                    toast.remove(tid);
                                  } catch (e) {
                                    toast.remove(tid);
                                    toast.error("Gagal update");
                                  }
                                }}
                              >
                                {fs.is_active ? "Nonaktifkan" : "Aktifkan"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {tab === "testimonials" ? (
              <div className="admin-panel admin-panel--fill admin-testimonialsPanel admin-workspacePane">
                <div className="admin-panel-head">
                  <div>
                    <div className="admin-panel-title">Testimoni</div>
                    <div className="admin-panel-sub">{analyticsSummary.activeTestimonials} tayang</div>
                  </div>
                </div>

                <div className="admin-panel-body admin-panel-body--scroll">
                  <form className="admin-testimonial-form admin-stickyTools" onSubmit={addTestimonials}>
                    <label className="admin-fileBtn">
                      <input name="files" type="file" accept="image/*" multiple />
                      Pilih gambar
                    </label>
                    <input name="caption" className="input" placeholder="Caption (opsional)" />
                    <input name="customer_name" className="input" placeholder="Nama pelanggan" />
                    <input name="product_name" className="input" placeholder="Produk yang dibeli" />
                    <input name="purchased_at" className="input" type="date" aria-label="Tanggal pembelian" />
                    <label className="admin-check"><input name="is_verified" type="checkbox" /> Pembelian terverifikasi</label>
                    <button className="btn btn-primary" type="submit">
                      Upload
                    </button>
                  </form>

                  <div className="admin-grid" style={{ marginTop: 14 }}>
                    {testimonials.map((t) => (
                      <div key={t.id} className="admin-thumb">
                        <img src={t.image_url} alt={t.caption || "testimoni"} />
                        {t.caption ? <div className="admin-thumb-caption">{t.caption}</div> : null}
                        {(t.customer_name || t.product_name) ? <div className="admin-thumb-caption">{[t.customer_name, t.product_name].filter(Boolean).join(" · ")}</div> : null}
                        <div className="admin-thumb-actions">
                          <button
                            className={"btn btn-sm " + (t.is_active ? "btn-ghost" : "")}
                            type="button"
                            onClick={() => updateTestimonial(t.id, { is_active: !t.is_active })}
                          >
                            {t.is_active ? "Off" : "On"}
                          </button>
                          <button className={"btn btn-sm " + (t.is_verified ? "btn-primary" : "btn-ghost")} type="button" onClick={() => updateTestimonial(t.id, { is_verified: !t.is_verified })}>
                            {t.is_verified ? "Verified" : "Verifikasi"}
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            type="button"
                            onClick={() => {
                              openConfirm({
                                title: "Edit caption",
                                prompt: true,
                                promptDefault: t.caption || "",
                                promptLabel: "Caption",
                                confirmLabel: "Simpan",
                                onConfirm: (newCaption) =>
                                  updateTestimonial(t.id, { caption: String(newCaption || "") }),
                              });
                            }}
                          >
                            Caption
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
              <div className="admin-settingsGrid admin-workspaceScroll">
                <div className="admin-panel">
                  {/* Section 1: Kontak & Pembayaran */}
                  <div className="admin-panel-head">
                    <div>
                      <div className="admin-panel-title">Kontak & pembayaran</div>
                      <div className="admin-panel-sub">WA admin + payload QRIS checkout</div>
                    </div>
                  </div>

                  <div className="admin-panel-body">
                    <div className="admin-form-grid admin-form-grid--settings">
                      <label className="admin-field admin-field-full">
                        <span>WhatsApp Admin</span>
                        <input
                          className="input"
                          value={settingsWhatsApp}
                          placeholder="62813..."
                          onChange={(e) => setSettingsWhatsApp(e.target.value)}
                        />
                        <div className="hint subtle">Format angka saja, contoh 62813…</div>
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
                        <div className="hint subtle">Dipakai generate QR dengan nominal otomatis.</div>
                      </label>

                      <label className="admin-field admin-field-full">
                        <span>Fallback QR Image URL</span>
                        <input
                          className="input"
                          value={settingsQrisImageUrl}
                          placeholder="https://..."
                          onChange={(e) => setSettingsQrisImageUrl(e.target.value)}
                        />
                        <div className="hint subtle">Opsional jika generator QR gagal.</div>
                      </label>
                    </div>

                    <div className="admin-form-actions">
                      <button className="btn btn-primary" type="button" onClick={() => saveWhatsApp(settingsWhatsApp)}>
                        Simpan WhatsApp
                      </button>
                      <button className="btn btn-ghost" type="button" onClick={() => saveQrisSettings(settingsQrisBase, settingsQrisImageUrl)}>
                        Simpan QRIS
                      </button>
                    </div>
                  </div>

                  {/* Section 2: Pop-up Promosi & Jasa Akademik */}
                  <div className="admin-panel-head" style={{ borderTop: "1px solid var(--admin-border, rgba(255,255,255,0.08))", paddingTop: 20 }}>
                    <div>
                      <div className="admin-panel-title">Pop-up Promosi & Jasa Akademik</div>
                      <div className="admin-panel-sub">Kontrol tayang pop-up penawaran layanan kampus di storefront</div>
                    </div>
                  </div>

                  <div className="admin-panel-body">
                    <label className="admin-checkboxLabel" style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14, fontWeight: 700, margin: "4px 0 12px" }}>
                      <input
                        type="checkbox"
                        checked={settingsAcademicPopupEnabled}
                        onChange={(e) => setSettingsAcademicPopupEnabled(e.target.checked)}
                        style={{ width: 18, height: 18, accentColor: "#10b981", cursor: "pointer" }}
                      />
                      <span>Aktifkan Pop-up Jasa Akademik di Storefront</span>
                    </label>
                    <div className="hint subtle" style={{ marginBottom: 16 }}>
                      Jika diaktifkan, pop-up hanya muncul sekali per sesi setelah katalog layanan berhasil dimuat. Jika dimatikan, storefront tidak menjadwalkannya.
                    </div>

                    <div className="admin-form-actions">
                      <button
                        className="btn btn-primary"
                        type="button"
                        onClick={() => saveAcademicPopupSettings(settingsAcademicPopupEnabled)}
                      >
                        Simpan Status Pop-up Akademik
                      </button>
                    </div>
                  </div>

                  {/* Section 3: Catatan sistem */}
                  <div className="admin-panel-head" style={{ borderTop: "1px solid var(--admin-border, rgba(255,255,255,0.08))", paddingTop: 20 }}>
                    <div>
                      <div className="admin-panel-title">Catatan sistem</div>
                      <div className="admin-panel-sub">Status operasional singkat</div>
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

      {/* Create Product Modal - simplified for daily ops */}
      <Modal
        open={productModalOpen}
        title="Tambah Produk"
        size="sm"
        onClose={() => setProductModalOpen(false)}
        footer={
          <div className="modal-actions modal-actions--fill">
            <button className="btn btn-ghost" type="button" onClick={() => setProductModalOpen(false)}>
              Batal
            </button>
            <button className="btn btn-primary" type="button" onClick={createProduct}>
              Simpan Produk
            </button>
          </div>
        }
      >
        <div className="admin-form-grid admin-form-grid--simple admin-form-grid--modal">
          <div className="admin-field admin-field-full">
            <span>Ikon produk</span>
            <div className="admin-icon-row">
              {newProduct.icon_url ? (
                <img className="admin-icon-preview" src={newProduct.icon_url} alt="preview" />
              ) : (
                <div className="admin-icon-preview admin-icon-fallback">
                  {String(newProduct.name || "?").trim().slice(0, 1).toUpperCase() || "?"}
                </div>
              )}
              <div className="admin-icon-actions">
                <label className="admin-fileBtn">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      uploadNewProductIcon(file);
                      e.target.value = "";
                    }}
                  />
                  Pilih gambar
                </label>
                <div className="hint subtle">JPG / PNG / WebP</div>
                {newProduct.icon_url ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setNewProduct((p) => ({ ...p, icon_url: "" }))}
                  >
                    Hapus ikon
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <label className="admin-field admin-field-full">
            <span>Nama produk</span>
            <input
              className="input"
              value={newProduct.name}
              onChange={(e) => setNewProduct((p) => ({ ...p, name: e.target.value }))}
              placeholder="Contoh: Netflix Premium"
              autoFocus
            />
          </label>

          <label className="admin-field admin-field-full">
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
            <span>
              Deskripsi singkat <em className="admin-fieldOptional">(opsional)</em>
            </span>
            <textarea
              className="input admin-textarea admin-textarea--short"
              value={newProduct.description}
              onChange={(e) => setNewProduct((p) => ({ ...p, description: e.target.value }))}
              rows={2}
              placeholder="Contoh: Akun ready, garansi replace full"
            />
          </label>

          <label className="admin-field admin-field-switch admin-field-full">
            <span>Langsung aktif di katalog</span>
            <input
              type="checkbox"
              checked={newProduct.is_active !== false}
              onChange={(e) => setNewProduct((p) => ({ ...p, is_active: e.target.checked }))}
            />
          </label>

          <p className="admin-formHint admin-field-full">
            Slug & urutan otomatis. Setelah simpan, tambah paket di Varian.
          </p>
        </div>
      </Modal>

      {/* Variant Modal - core fields first, advanced collapsed */}
      <Modal
        open={variantModalOpen}
        title={variantMode === "edit" ? "Edit Paket" : "Tambah Paket"}
        size="sm"
        onClose={() => setVariantModalOpen(false)}
        footer={
          <div className="modal-actions modal-actions--fill">
            <button className="btn btn-ghost" type="button" onClick={() => setVariantModalOpen(false)}>
              Batal
            </button>
            <button className="btn btn-primary" type="button" onClick={saveVariant}>
              Simpan Paket
            </button>
          </div>
        }
      >
        <div className="admin-form-grid admin-form-grid--simple admin-form-grid--modal">
          <label className="admin-field admin-field-full">
            <span>Nama paket</span>
            <input
              className="input"
              value={variantForm.name}
              onChange={(e) => setVariantForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Contoh: 1 Bulan · Private"
              autoFocus
            />
          </label>

          <label className="admin-field">
            <span>Harga (Rp)</span>
            <input
              className="input"
              type="number"
              min={0}
              step={1000}
              value={variantForm.price_idr}
              onChange={(e) => setVariantForm((p) => ({ ...p, price_idr: e.target.value }))}
              placeholder="35000"
            />
          </label>

          <label className="admin-field">
            <span>Stok</span>
            <input
              className="input"
              type="number"
              min={0}
              value={variantForm.stock}
              onChange={(e) => setVariantForm((p) => ({ ...p, stock: Number(e.target.value) }))}
            />
          </label>

          <label className="admin-field admin-field-full">
            <span>Durasi <em className="admin-fieldOptional">(opsional)</em></span>
            <input
              className="input"
              value={variantForm.duration_label}
              onChange={(e) => setVariantForm((p) => ({ ...p, duration_label: e.target.value }))}
              placeholder="1 bulan"
            />
          </label>

          <label className="admin-field admin-field-switch admin-field-full">
            <span>Paket aktif</span>
            <input
              type="checkbox"
              checked={variantForm.is_active !== false}
              onChange={(e) => setVariantForm((p) => ({ ...p, is_active: e.target.checked }))}
            />
          </label>

          <label className="admin-field admin-field-full">
            <span>Deskripsi paket</span>
            <textarea
              className="input admin-textarea admin-textarea--short"
              value={variantForm.description}
              onChange={(e) => setVariantForm((p) => ({ ...p, description: e.target.value }))}
              rows={3}
              placeholder="Detail paket / aturan (opsional)"
            />
          </label>

          <label className="admin-field admin-field-full">
            <span>Teks garansi</span>
            <input
              className="input"
              value={variantForm.guarantee_text}
              onChange={(e) => setVariantForm((p) => ({ ...p, guarantee_text: e.target.value }))}
              placeholder="All full garansi"
            />
          </label>

          <label className="admin-field admin-field-switch admin-field-full">
            <span>Wajib email buyer (sebelum QRIS)</span>
            <input
              type="checkbox"
              checked={!!variantForm.requires_buyer_email}
              onChange={(e) => setVariantForm((p) => ({ ...p, requires_buyer_email: e.target.checked }))}
            />
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDialog}
        title={confirmDialog?.title}
        message={confirmDialog?.message}
        confirmLabel={confirmDialog?.confirmLabel}
        danger={confirmDialog?.danger}
        prompt={confirmDialog?.prompt}
        promptDefault={confirmDialog?.promptDefault}
        promptLabel={confirmDialog?.promptLabel}
        onConfirm={confirmDialog?.onConfirm}
        onCancel={confirmDialog?.onCancel}
      />

      <Modal
        open={!!activeOrder}
        title={activeOrder ? `Detail Order ${activeOrder.order_code || activeOrder.id}` : "Detail Order"}
        onClose={() => setActiveOrderId("")}
        footer={
          <div className="modal-actions">
            <button className="btn btn-ghost" type="button" onClick={() => setActiveOrderId("")}>
              Tutup
            </button>
            {activeOrder ? (
              <button className="btn" type="button" onClick={() => saveOrderAdminNote(activeOrder.id)}>
                Simpan catatan
              </button>
            ) : null}
          </div>
        }
      >
        {activeOrder ? (
          <div className="admin-orderBodyModern admin-orderBodyModal">
            {/* ── Status Timeline ── */}
            <div className="admin-orderTimeline">
              {getTimeline(activeOrder.status).map((step, index, arr) => (
                <div key={step.key} className="admin-timelineRow">
                  <div className={`admin-timelineDot ${step.done ? "is-done" : step.active ? "is-active" : ""}`}>
                    {step.done ? "✓" : null}
                  </div>
                  <div className="admin-timelineLabel">
                    <strong>{step.label}</strong>
                    <small>{step.done ? "Selesai" : step.active ? "Aktif" : "Menunggu"}</small>
                  </div>
                  {index < arr.length - 1 ? <div className="admin-timelineLine" /> : null}
                </div>
              ))}
            </div>

            {/* ── Quick Action Buttons ── */}
            <div className="admin-orderQuickActions">
              {String(activeOrder.status || "pending") !== "done" && String(activeOrder.status || "pending") !== "cancelled" ? (
                <button
                  className="btn"
                  type="button"
                  onClick={() => updateOrderStatus(activeOrder.id, "done")}
                >
                  ✓ Tandai Selesai
                </button>
              ) : null}
              {String(activeOrder.status || "pending") !== "cancelled" ? (
                <button
                  className="btn btn-danger"
                  type="button"
                  onClick={() => updateOrderStatus(activeOrder.id, "cancelled")}
                >
                  Batalkan
                </button>
              ) : null}
              {buildCustomerWaUrl(activeOrder) ? (
                <a
                  className="btn btn-ghost"
                  href={buildCustomerWaUrl(activeOrder)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Kirim Notif WA
                </a>
              ) : (
                <button className="btn btn-ghost" type="button" disabled title="Nomor WA tidak tersedia">
                  Kirim Notif WA
                </button>
              )}
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => copyStatusLink(activeOrder.order_code)}
              >
                Salin link status
              </button>
              {buildAdminOrderAlertUrl(waNumber, activeOrder) ? (
                <a
                  className="btn btn-ghost"
                  href={buildAdminOrderAlertUrl(waNumber, activeOrder)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Template alert WA
                </a>
              ) : null}
            </div>

            <div className="admin-orderDetailFacts admin-orderDetailFacts--solo">
              <div className="admin-orderDetailFact">
                <span>Waktu order</span>
                <strong>{formatAdminDateTime(activeOrder.created_at)}</strong>
                <small>Waktu Indonesia (WIB)</small>
              </div>
            </div>

            <div className="admin-orderMetaGrid">
              <div className="admin-orderMetaCard">
                <span>Kontak customer</span>
                <div className="admin-orderMetaValueRow">
                  <strong>{activeOrder.customer_whatsapp || "-"}</strong>
                  {activeOrder.customer_whatsapp ? (
                    <button
                      className="btn btn-ghost btn-sm admin-copyPhoneBtn"
                      type="button"
                      onClick={() => copyCustomerPhone(activeOrder.customer_whatsapp)}
                      title="Salin nomor WhatsApp"
                    >
                      <Copy size={14} />
                      Salin
                    </button>
                  ) : null}
                </div>
                {activeOrderWhatsApp ? (
                  <a href={activeOrderWhatsApp} target="_blank" rel="noreferrer">
                    Chat WhatsApp
                  </a>
                ) : (
                  <small>Tidak ada nomor WA</small>
                )}
              </div>
              <div className="admin-orderMetaCard">
                <span>Status sekarang</span>
                <strong>{prettyOrderStatus(activeOrder.status)}</strong>
                <small>{activeOrder.payment_reference ? `Referensi: ${activeOrder.payment_reference}` : (activeOrder.promo_code ? `Promo ${activeOrder.promo_code}` : "Tanpa promo")}</small>
              </div>
              <div className="admin-orderMetaCard">
                <span>Update status</span>
                <select
                  className="input admin-select"
                  value={String(activeOrder.status || "pending")}
                  onChange={(e) =>
                    requestOrderStatusChange(activeOrder.id, e.target.value, activeOrder.status)
                  }
                >
                  {ORDER_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="admin-orderItemsSection">
              <div className="admin-orderItemsHead">
                <strong>Produk dipesan</strong>
                <span>{getOrderItemCount(activeOrder)} item</span>
              </div>
              <div className="admin-order-items">
                {getSafeOrderItems(activeOrder).map((it, idx) => (
                  <div key={`${activeOrder.id}-${idx}`} className="admin-order-item">
                    <div>
                      <b>{it.product_name || "Produk"}</b>
                      <div className="admin-order-itemMeta">
                        {[it.variant_name, it.duration_label].filter(Boolean).join(" · ") || "Tanpa varian"}
                      </div>
                    </div>
                    <div className="admin-order-itemPrice">
                      <strong>{it.qty || 1}×</strong>
                      <span>{formatIDR(it.price_idr)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="admin-order-pricing">
              <div className="admin-order-priceRow">
                <span>Subtotal</span>
                <b>{formatIDR(activeOrder.subtotal_idr)}</b>
              </div>
              <div className="admin-order-priceRow">
                <span>Diskon {activeOrder.discount_percent ? `(${activeOrder.discount_percent}%)` : ""}</span>
                <b>- {formatIDR(getOrderDiscountAmount(activeOrder))}</b>
              </div>
              <div className="admin-order-priceRow total">
                <span>Total bayar</span>
                <b>{formatIDR(activeOrder.total_idr)}</b>
              </div>
            </div>

            <div className={"admin-order-notes" + (activeOrder.notes ? "" : " empty")}>
              <div className="admin-order-notesTitle">Catatan customer</div>
              <div>{activeOrder.notes || "Tidak ada catatan tambahan."}</div>
            </div>

            <div className="admin-order-adminNote">
              <div className="admin-order-notesTitle">Catatan admin</div>
              <textarea
                className="input admin-textarea"
                rows={3}
                value={adminNoteDrafts[activeOrder.id] || ""}
                onChange={(e) => setAdminNoteDrafts((prev) => ({ ...prev, [activeOrder.id]: e.target.value }))}
                placeholder="Tulis detail/kredensial akun yang dikirimkan atau catatan penting yang AKAN dilihat langsung oleh customer di halaman status."
              />
              <div className="admin-order-adminActions">
                {activeOrder.payment_proof_url ? (
                  <a className="admin-proof" href={activeOrder.payment_proof_url} target="_blank" rel="noreferrer">
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
      </Modal>
    </div>
  );
}

