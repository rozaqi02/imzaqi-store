import { supabase } from "./supabaseClient";

export async function fetchProducts({ includeInactive = false } = {}) {
  const q = supabase
    .from("products")
    .select("id,slug,name,description,icon_url,is_active,sort_order,product_variants(id,product_id,name,duration_label,price_idr,guarantee_text,is_active,sort_order,stock,sold_count)")
    .order("sort_order", { ascending: true })
    .order("sort_order", { foreignTable: "product_variants", ascending: true });

  if (!includeInactive) q.eq("is_active", true);

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function fetchTestimonials({ includeInactive = false } = {}) {
  const q = supabase
    .from("testimonials")
    .select("id,image_url,caption,is_active,sort_order,created_at")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (!includeInactive) q.eq("is_active", true);

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function fetchSettings() {
  const { data, error } = await supabase.from("site_settings").select("key,value");
  if (error) throw error;
  const map = {};
  (data || []).forEach(r => { map[r.key] = r.value; });
  return map;
}

export async function upsertSetting(key, value) {
  const { error } = await supabase
    .from("site_settings")
    .upsert({ key, value }, { onConflict: "key" });
  if (error) throw error;
}

export async function fetchPromoCodes() {
  const { data, error } = await supabase.from("promo_codes").select("code,percent,is_active,updated_at").order("updated_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchTopSellingIds() {
  // Panggil RPC database
  const { data, error } = await supabase.rpc("get_top_products");
  if (error) {
    console.error("Gagal load best seller:", error);
    return [];
  }
  // Kembalikan array ID saja, urut dari yang terlaris
  return (data || []).map((x) => x.product_id);
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