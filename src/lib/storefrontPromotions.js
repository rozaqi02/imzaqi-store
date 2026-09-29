import { getCatalogPriceRange, isKnownOutOfStock, summarizeCatalogCopy } from "./format";

export const PROMOTION_DEFAULTS = {
  flash_sale_popup: { enabled: false },
  academic_popup: { enabled: false },
  new_product_popup: { enabled: false, product_id: "", title: "", description: "", badge: "PRODUK BARU", button_text: "Lihat produknya", link: "", show_on: "home" },
  new_product_banner: { enabled: false, product_id: "", text: "", badge: "BARU", color: "green", link: "" },
};

export const BANNER_COLORS = [
  { id: "green", label: "Hijau", color: "#009e60" },
  { id: "black", label: "Hitam", color: "#181818" },
  { id: "yellow", label: "Kuning", color: "#f59e0b" },
  { id: "red", label: "Merah", color: "#dc2626" },
];

export function normalizePromotion(key, value = {}) {
  const defaults = PROMOTION_DEFAULTS[key];
  const result = Object.fromEntries(Object.entries(defaults).map(([field, fallback]) =>
    [field, field === "enabled" ? value?.enabled === true : String(value?.[field] ?? fallback).trim()]
  ));
  if (key === "new_product_popup") result.show_on = result.show_on === "all" ? "all" : "home";
  if (key === "new_product_banner" && !BANNER_COLORS.some(c => c.id === result.color)) result.color = "green";
  return result;
}

export function productPromotionCopy(product) {
  return {
    title: product ? `Baru hadir: ${product.name}` : "Produk baru di Imzaqi Store",
    description: summarizeCatalogCopy(product?.description) || "Temukan pilihan paket dan detail produk di katalog kami.",
    text: product ? `${product.name} sekarang tersedia. Lihat paketnya!` : "Produk baru tersedia. Jelajahi katalog kami!",
    link: product?.slug ? `/produk/${product.slug}` : "/produk",
  };
}

export function isPromotionLinkValid(value) {
  const link = String(value || "").trim();
  if (!link) return true;
  if (/\s|[\\\u0000-\u001f]/.test(link)) return false;
  if (link.startsWith("/") && !link.startsWith("//")) return true;
  try { return ["http:", "https:"].includes(new URL(link).protocol); }
  catch { return false; }
}

export function promotionDestination(link, product) {
  return String(link || "").trim() && isPromotionLinkValid(link) ? String(link).trim() : productPromotionCopy(product).link;
}

export function resolvePromotionCopy(config, product) {
  const automatic = productPromotionCopy(product);
  const variants = (product?.product_variants || []).filter(v => v.is_active !== false);
  return {
    title: config.title || automatic.title,
    description: config.description || automatic.description,
    text: config.text || automatic.text,
    badge: config.badge || ("show_on" in config ? "PRODUK BARU" : "BARU"),
    button: config.button_text || "Lihat produknya",
    link: promotionDestination(config.link, product),
    price: getCatalogPriceRange(variants).minPrice,
  };
}

export function validatePromotion(key, config, products) {
  const errors = {};
  if (config.enabled && !isPromotionLinkValid(config.link)) errors.link = "Gunakan alamat seperti /produk/netflix atau https://contoh.com.";
  const product = products.find(p => String(p.id) === String(config.product_id) && p.is_active !== false);
  if (config.enabled && key === "new_product_popup" && !product) errors.product_id = "Pilih produk aktif agar logo, harga, dan tautannya bisa ditampilkan.";
  if (config.enabled && key === "new_product_banner" && !config.text?.trim() && !product) errors.text = "Pilih produk atau tulis pesan pengumuman sebelum mengaktifkan banner.";
  return errors;
}

export function readyFlashPromotions(sales, products, now = Date.now()) {
  return (sales || []).filter(sale => {
    if (sale.is_active === false || !(Date.parse(sale.starts_at) <= now) || !(Date.parse(sale.ends_at) > now)) return false;
    if (!(Number(sale.discount_percent) > 0 && Number(sale.discount_percent) < 100)) return false;
    return products.some(product => product.is_active !== false && (product.product_variants || []).some(variant =>
      variant.id === sale.variant_id && variant.is_active !== false && !isKnownOutOfStock(variant)
    ));
  });
}
