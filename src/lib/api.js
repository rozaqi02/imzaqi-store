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

export async function fetchProducts({ includeInactive = false, useCache = !includeInactive, ttlMs = 45000 } = {}) {
  const cacheKey = `products:${includeInactive ? "all" : "active"}`;
  const cached = useCache ? readPublicCache(cacheKey, ttlMs) : null;
  if (cached) return cached;

  let q = supabase
    .from("products")
    .select(
      "id,slug,name,description,icon_url,category,is_active,sort_order,product_variants(id,product_id,name,duration_label,description,price_idr,guarantee_text,is_active,sort_order,stock,sold_count)"
    )
    .order("sort_order", { ascending: true })
    .order("sort_order", { foreignTable: "product_variants", ascending: true });

  if (!includeInactive) q.eq("is_active", true);

  let { data, error } = await q;

  if (error && /category/i.test(String(error?.message || ""))) {
    q = supabase
      .from("products")
      .select(
        "id,slug,name,description,icon_url,is_active,sort_order,product_variants(id,product_id,name,duration_label,description,price_idr,guarantee_text,is_active,sort_order,stock,sold_count)"
      )
      .order("sort_order", { ascending: true })
      .order("sort_order", { foreignTable: "product_variants", ascending: true });

    if (!includeInactive) q.eq("is_active", true);
    ({ data, error } = await q);
  }

  if (error) throw error;
  const result = data || [];
  if (useCache) writePublicCache(cacheKey, result);
  return result;
}

export async function fetchProductBySlug(slug, { includeInactive = false, useCache = !includeInactive, ttlMs = 45000 } = {}) {
  const cacheKey = `product:${includeInactive ? "all" : "active"}:${slug}`;
  const cached = useCache ? readPublicCache(cacheKey, ttlMs) : null;
  if (cached) return cached;

  let q = supabase
    .from("products")
    .select(
      "id,slug,name,description,icon_url,category,is_active,sort_order,product_variants(id,product_id,name,duration_label,description,price_idr,guarantee_text,is_active,sort_order,stock,sold_count)"
    )
    .eq("slug", slug);

  if (!includeInactive) q = q.eq("is_active", true);

  q = q.order("sort_order", { foreignTable: "product_variants", ascending: true }).single();

  let { data, error } = await q;

  if (error && /category/i.test(String(error?.message || ""))) {
    q = supabase
      .from("products")
      .select(
        "id,slug,name,description,icon_url,is_active,sort_order,product_variants(id,product_id,name,duration_label,description,price_idr,guarantee_text,is_active,sort_order,stock,sold_count)"
      )
      .eq("slug", slug);

    if (!includeInactive) q = q.eq("is_active", true);
    q = q.order("sort_order", { foreignTable: "product_variants", ascending: true }).single();
    ({ data, error } = await q);
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
  const { data, error } = await supabase.from("promo_codes").select("code,percent,is_active,updated_at").order("updated_at", { ascending: false });
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
