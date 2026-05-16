import { supabase } from "./supabaseClient";

const PUBLIC_CACHE_PREFIX = "imzaqi-public-cache:";
const publicCacheMemory = new Map();

function safeStorage() {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

function readPublicCache(key, ttlMs) {
  const now = Date.now();
  const memoryEntry = publicCacheMemory.get(key);
  if (memoryEntry && now - memoryEntry.at < ttlMs) return memoryEntry.data;

  const storage = safeStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(`${PUBLIC_CACHE_PREFIX}${key}`);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || now - Number(parsed.at || 0) >= ttlMs) return null;

    publicCacheMemory.set(key, parsed);
    return parsed.data;
  } catch {
    return null;
  }
}

function writePublicCache(key, data) {
  const entry = { at: Date.now(), data };
  publicCacheMemory.set(key, entry);

  const storage = safeStorage();
  if (!storage) return;

  try {
    storage.setItem(`${PUBLIC_CACHE_PREFIX}${key}`, JSON.stringify(entry));
  } catch {}
}

function clearPublicCache(key) {
  publicCacheMemory.delete(key);

  const storage = safeStorage();
  if (!storage) return;

  try {
    storage.removeItem(`${PUBLIC_CACHE_PREFIX}${key}`);
  } catch {}
}

function buildProductsSelect({ includeCategory = true, includeTimestamps = true } = {}) {
  const productFields = [
    "id",
    "slug",
    "name",
    "description",
    "icon_url",
    includeCategory ? "category" : null,
    "is_active",
    "sort_order",
    includeTimestamps ? "created_at" : null,
    includeTimestamps ? "updated_at" : null,
  ]
    .filter(Boolean)
    .join(",");

  const variantFields = [
    "id",
    "product_id",
    "name",
    "duration_label",
    "description",
    "price_idr",
    "guarantee_text",
    "is_active",
    "sort_order",
    "stock",
    "sold_count",
    "requires_buyer_email",
    includeTimestamps ? "created_at" : null,
    includeTimestamps ? "updated_at" : null,
  ]
    .filter(Boolean)
    .join(",");

  return `${productFields},product_variants(${variantFields})`;
}

export async function fetchProducts({ includeInactive = false, useCache = !includeInactive, ttlMs = 45000 } = {}) {
  const cacheKey = `products:v2:${includeInactive ? "all" : "active"}`;
  const cached = useCache ? readPublicCache(cacheKey, ttlMs) : null;
  if (cached) return cached;

  const attempts = [
    { includeCategory: true, includeTimestamps: true },
    { includeCategory: false, includeTimestamps: true },
    { includeCategory: true, includeTimestamps: false },
    { includeCategory: false, includeTimestamps: false },
  ];

  let data;
  let error;
  for (const attempt of attempts) {
    let q = supabase
      .from("products")
      .select(buildProductsSelect(attempt))
      .order("sort_order", { ascending: true })
      .order("sort_order", { foreignTable: "product_variants", ascending: true });

    if (!includeInactive) q = q.eq("is_active", true);

    // eslint-disable-next-line no-await-in-loop
    const res = await q;
    data = res.data;
    error = res.error;

    if (!error) break;

    const message = String(error?.message || "").toLowerCase();
    const schemaMismatch =
      message.includes("does not exist") ||
      message.includes("could not find") ||
      message.includes("unknown column") ||
      message.includes("category") ||
      message.includes("created_at") ||
      message.includes("updated_at");

    if (!schemaMismatch) break;
  }

  if (error) throw error;
  const result = data || [];
  if (useCache) writePublicCache(cacheKey, result);
  return result;
}

export async function fetchProductBySlug(slug, { includeInactive = false, useCache = !includeInactive, ttlMs = 45000 } = {}) {
  const cacheKey = `product:v2:${includeInactive ? "all" : "active"}:${slug}`;
  const cached = useCache ? readPublicCache(cacheKey, ttlMs) : null;
  if (cached) return cached;

  const attempts = [
    { includeCategory: true, includeTimestamps: true },
    { includeCategory: false, includeTimestamps: true },
    { includeCategory: true, includeTimestamps: false },
    { includeCategory: false, includeTimestamps: false },
  ];

  let data;
  let error;
  for (const attempt of attempts) {
    let q = supabase
      .from("products")
      .select(buildProductsSelect(attempt))
      .eq("slug", slug);

    if (!includeInactive) q = q.eq("is_active", true);

    q = q.order("sort_order", { foreignTable: "product_variants", ascending: true }).single();

    // eslint-disable-next-line no-await-in-loop
    const res = await q;
    data = res.data;
    error = res.error;

    if (!error) break;

    const message = String(error?.message || "").toLowerCase();
    const schemaMismatch =
      message.includes("does not exist") ||
      message.includes("could not find") ||
      message.includes("unknown column") ||
      message.includes("category") ||
      message.includes("created_at") ||
      message.includes("updated_at");

    if (!schemaMismatch) break;
  }

  if (error) throw error;
  if (useCache && data) writePublicCache(cacheKey, data);
  return data;
}

export async function fetchTestimonials({ includeInactive = false, useCache = !includeInactive, ttlMs = 45000 } = {}) {
  const cacheKey = `testimonials:${includeInactive ? "all" : "active"}`;
  const cached = useCache ? readPublicCache(cacheKey, ttlMs) : null;
  if (cached) return cached;

  const q = supabase
    .from("testimonials")
    .select("id,image_url,caption,is_active,sort_order,created_at")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (!includeInactive) q.eq("is_active", true);

  const { data, error } = await q;
  if (error) throw error;
  const result = data || [];
  if (useCache) writePublicCache(cacheKey, result);
  return result;
}

export async function fetchSettings({ useCache = true, ttlMs = 30000 } = {}) {
  const cacheKey = "settings";
  const cached = useCache ? readPublicCache(cacheKey, ttlMs) : null;
  if (cached) return cached;

  const { data, error } = await supabase.from("site_settings").select("key,value");
  if (error) throw error;
  const map = {};
  (data || []).forEach(r => { map[r.key] = r.value; });
  if (useCache) writePublicCache(cacheKey, map);
  return map;
}

export async function upsertSetting(key, value) {
  const { data, error } = await supabase
    .from("site_settings")
    .update({ value, updated_at: new Date().toISOString() })
    .eq("key", key)
    .select("key")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Setting ${key} tidak ditemukan di database.`);
  clearPublicCache("settings");
}

export async function fetchPromoCodes() {
  const { data, error } = await supabase.from("promo_codes").select("code,percent,is_active,updated_at,expired_at,max_uses,used_count").order("updated_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchTopSellingIds({ useCache = true, ttlMs = 45000 } = {}) {
  const cacheKey = "top-products";
  const cached = useCache ? readPublicCache(cacheKey, ttlMs) : null;
  if (cached) return cached;

  // Panggil RPC database
  const { data, error } = await supabase.rpc("get_top_products");
  if (error) {
    console.error("Gagal load best seller:", error);
    return [];
  }
  // Kembalikan array ID saja, urut dari yang terlaris
  const result = (data || []).map((x) => x.product_id);
  if (useCache) writePublicCache(cacheKey, result);
  return result;
}

// New: Check stock availability for cart items
export async function checkStockAvailability(cartItems) {
  const variantIds = cartItems.map(item => item.variant_id);
  
  const { data, error } = await supabase
    .from("product_variants")
    .select("id, name, stock")
    .in("id", variantIds);
  
  if (error) throw error;
  
  const stockMap = {};
  (data || []).forEach(variant => {
    stockMap[variant.id] = {
      name: variant.name,
      stock: variant.stock
    };
  });
  
  const outOfStock = [];
  const insufficient = [];
  
  cartItems.forEach(item => {
    const variantStock = stockMap[item.variant_id];
    if (!variantStock) {
      outOfStock.push(item);
    } else if (variantStock.stock < item.qty) {
      insufficient.push({
        ...item,
        availableStock: variantStock.stock
      });
    }
  });
  
  return {
    isAvailable: outOfStock.length === 0 && insufficient.length === 0,
    outOfStock,
    insufficient,
    stockMap
  };
}

// New: Update variant stock manually (for admin)
export async function updateVariantStock(variantId, newStock) {
  const { error } = await supabase
    .from("product_variants")
    .update({ stock: newStock, updated_at: new Date().toISOString() })
    .eq("id", variantId);
  
  if (error) throw error;
}

// ── Analytics: daily stats (dari tabel daily_stats) ──
export async function fetchDailyStats({ days = 30 } = {}) {
  const { data, error } = await supabase.rpc("get_daily_stats", { p_days: days });
  if (error) throw error;
  return (data || []).map((row) => ({
    date: row.stat_date,
    uniqueViews: Number(row.unique_views || 0),
    totalOrders: Number(row.total_orders || 0),
    revenueIdr: Number(row.revenue_idr || 0),
  }));
}

// ── Analytics: visitor stats (new vs returning) ──
export async function fetchVisitorStats({ days = 30 } = {}) {
  const { data, error } = await supabase.rpc("get_visitor_stats", { p_days: days });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    totalVisitors: Number(row?.total_visitors || 0),
    returningVisitors: Number(row?.returning_visitors || 0),
    newVisitors: Number(row?.new_visitors || 0),
  };
}

// ── Analytics: top pages ──
export async function fetchTopPages({ days = 30, limit = 10 } = {}) {
  const { data, error } = await supabase.rpc("get_top_pages", { p_days: days, p_limit: limit });
  if (error) throw error;
  return (data || []).map((row) => ({
    path: row.path,
    viewCount: Number(row.view_count || 0),
  }));
}

// ── Track page view ke tabel page_views ──
export async function trackPageView({ visitorId, path, referrer } = {}) {
  if (!visitorId) return;
  const { error } = await supabase.from("page_views").insert({
    visitor_id: visitorId,
    path: path || null,
    referrer: referrer || null,
  });
  if (error) throw error;
}

// ── CSV Export helpers ──
export function csvEscapeValue(value) {
  const str = value == null ? "" : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export function buildOrdersCSV(orders) {
  const headers = [
    "order_code","created_at","status","customer_whatsapp",
    "total_idr","subtotal_idr","discount_percent","promo_code",
    "items_summary","notes","admin_note"
  ];
  const rows = (orders || []).map((o) => {
    const itemsSummary = Array.isArray(o.items)
      ? o.items.map((it) => `${it.product_name || ""} x${it.qty || 1}`).join("; ")
      : "";
    return [
      o.order_code,
      o.created_at,
      o.status,
      o.customer_whatsapp,
      o.total_idr,
      o.subtotal_idr,
      o.discount_percent,
      o.promo_code,
      itemsSummary,
      o.notes,
      o.admin_note,
    ].map(csvEscapeValue).join(",");
  });
  return [headers.join(","), ...rows].join("\n");
}

export function downloadCSV(csvString, filename) {
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Analytics: cohort return (visitors who came back) ──
export async function fetchCohortReturn({ days = 7 } = {}) {
  try {
    const { data, error } = await supabase.rpc("get_cohort_return", { p_days: days });
    if (error) throw error;
    return Number(data || 0);
  } catch {
    return 0;
  }
}
