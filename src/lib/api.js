import { supabase } from "./supabaseClient";

export async function fetchProducts({ includeInactive = false } = {}) {
  const q = supabase
    .from("products")
    .select("id,slug,name,description,icon_url,is_active,sort_order,product_variants(id,product_id,name,duration_label,price_idr,guarantee_text,is_active,sort_order)")
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
