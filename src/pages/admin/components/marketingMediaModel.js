import { getVariantEffectivePrice, isKnownOutOfStock } from "../../../lib/format.js";

export const MEDIA_FORMATS = {
  square: { label: "Feed / Chat", ratio: "1:1", width: 1080, height: 1080 },
  story: { label: "Status / Story", ratio: "9:16", width: 1080, height: 1920 },
  banner: { label: "Banner", ratio: "16:9", width: 1920, height: 1080 },
};

export const MEDIA_STYLES = [
  { id: "best_seller", name: "Pilihan Favorit", detail: "Editorial · hijau & kertas", bg: "#f4f0e5", ink: "#143f32", accent: "#bbe869", secondary: "#e76935", headline: ["BANYAK", "YANG PILIH."], tag: "PILIHAN PREMIUM" },
  { id: "flash_sale", name: "Promo Berani", detail: "Kontras · merah & mentega", bg: "#ffdf59", ink: "#411c21", accent: "#e93d36", secondary: "#ffedba", headline: ["HARGA KECIL.", "AKSES BESAR."], tag: "PROMO PILIHAN" },
  { id: "new_release", name: "Drop Terbaru", detail: "Electric · biru & lime", bg: "#202bb9", ink: "#f1f0ff", accent: "#cbf45b", secondary: "#ff9276", headline: ["BARU DATANG.", "SIAP DIPAKAI."], tag: "TEMUKAN YANG BARU" },
  { id: "student_promo", name: "Hemat Cerdas", detail: "Kolase · lilac & coral", bg: "#e9dcff", ink: "#3b244e", accent: "#f67b54", secondary: "#d3ec7c", headline: ["IDE BESAR.", "BUDGET PAS."], tag: "PILIHAN HEMAT" },
];

export function activeVariants(product) {
  return (Array.isArray(product?.product_variants) ? product.product_variants : [])
    .filter(v => v.is_active !== false);
}

export function chooseVariant(product, id, discounts = new Map()) {
  const variants = activeVariants(product);
  const selected = variants.find(v => String(v.id) === String(id));
  if (selected) return selected;
  const ready = variants.filter(v => !isKnownOutOfStock(v));
  return [...(ready.length ? ready : variants)].sort((a, b) => {
    const price = v => getVariantEffectivePrice(v, discounts) || Infinity;
    return price(a) - price(b);
  })[0] || null;
}

export function liveDiscounts(sales, now = Date.now()) {
  const map = new Map();
  for (const sale of sales || []) {
    const discount = Number(sale.discount_percent);
    if (sale.is_active !== false && Date.parse(sale.starts_at) <= now && Date.parse(sale.ends_at) > now && discount > 0 && discount < 100 && !map.has(sale.variant_id)) {
      map.set(sale.variant_id, discount);
    }
  }
  return map;
}

export function posterOffer(product, variant, discounts, overrides = {}) {
  const effective = getVariantEffectivePrice(variant, discounts);
  const manual = String(overrides.price ?? "").trim();
  const price = manual !== "" ? Number(manual) : effective;
  if (!Number.isSafeInteger(price) || price < 0 || (manual && price === 0)) {
    throw new Error("Harga manual harus berupa angka lebih dari 0.");
  }
  const base = Number(variant?.price_idr || 0);
  const original = base > price && price > 0 ? base : 0;
  return {
    name: String(product?.name || "Produk pilihan"),
    variant: String(variant?.name || ""),
    duration: String(overrides.duration || variant?.duration_label || ""),
    guarantee: String(variant?.guarantee_text || ""),
    price, original,
    discount: original ? Math.round((1 - price / original) * 100) : 0,
    outOfStock: Boolean(variant && isKnownOutOfStock(variant)),
    url: product?.slug ? `https://imzaqi.store/produk/${encodeURIComponent(product.slug)}` : "https://imzaqi.store/produk",
  };
}

export function paginateCatalog(products, size = 10) {
  const pages = [];
  for (let i = 0; i < products.length; i += size) pages.push(products.slice(i, i + size));
  return pages;
}

export function normalizeMediaPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
}
