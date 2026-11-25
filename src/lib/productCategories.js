import {
  Blocks,
  BookOpen,
  Bot,
  Film,
  GraduationCap,
  Music4,
  Palette,
  Sparkles,
  Smartphone,
} from "lucide-react";

export const PRODUCT_CATEGORIES = [
  { key: "streaming", label: "Streaming", icon: Film },
  { key: "music", label: "Music", icon: Music4 },
  { key: "tools", label: "Tools", icon: Blocks },
  { key: "ai", label: "AI", icon: Bot },
  { key: "design", label: "Design", icon: Palette },
  { key: "learning", label: "Belajar", icon: GraduationCap },
  { key: "academic", label: "Jasa Akademik", icon: BookOpen },
  { key: "other", label: "Lainnya", icon: Sparkles },
];

/** Storefront catalog pills - only two shop lines */
export const CATALOG_LINE_FILTERS = [
  { key: "app_premium", label: "App Premium", icon: Smartphone },
  { key: "academic", label: "Jasa Akademik", icon: BookOpen },
];

function inferCategoryFromName(name) {
  const n = String(name || "").toLowerCase();
  if (n.match(/turnitin|parafrase|paraphrase|plagiasi|zerogpt|mendeley|skripsi|tesis|jurnal/)) {
    return "academic";
  }
  if (n.match(/netflix|youtube|disney|prime|wetv|viu|iqiyi|hbo|hulu/)) return "streaming";
  if (n.match(/spotify|joox|apple music|yt music|deezer/)) return "music";
  if (n.match(/canva|figma|adobe|photoshop|illustrator/)) return "design";
  if (n.match(/chatgpt|copilot|midjourney|claude|gemini|perplexity/)) return "ai";
  if (n.match(/zoom|notion|office|capcut|alight|github|grammarly/)) return "tools";
  if (n.match(/coursera|udemy|skillshare|duolingo/)) return "learning";
  return "other";
}

export function getProductCategoryMeta(categoryKey) {
  const key = String(categoryKey || "").trim().toLowerCase();
  if (!key) return null;
  return PRODUCT_CATEGORIES.find((item) => item.key === key) || null;
}

export function resolveProductCategory(product) {
  const explicit = String(product?.category || "").trim().toLowerCase();
  const key = PRODUCT_CATEGORIES.some((item) => item.key === explicit)
    ? explicit
    : inferCategoryFromName(product?.name);

  return PRODUCT_CATEGORIES.find((item) => item.key === key) || PRODUCT_CATEGORIES.at(-1);
}

/**
 * Resolve optional category metadata for a testimonial item.
 * Returns null when neither category, product_id, nor product_name is set.
 */
export function resolveTestimonialCategory(testimonial, products = []) {
  const explicit = getProductCategoryMeta(testimonial?.category);
  if (explicit) return explicit;

  const productId = testimonial?.product_id;
  if (productId && Array.isArray(products) && products.length > 0) {
    const matchedById = products.find((item) => String(item?.id) === String(productId));
    if (matchedById) return resolveProductCategory(matchedById);
  }

  const productName = String(testimonial?.product_name || "").trim();
  if (productName) {
    if (Array.isArray(products) && products.length > 0) {
      const lowered = productName.toLowerCase();
      const matchedByName = products.find(
        (item) => String(item?.name || "").trim().toLowerCase() === lowered
      );
      if (matchedByName) return resolveProductCategory(matchedByName);
    }
    return resolveProductCategory({ name: productName });
  }

  return null;
}

export function isAcademicProduct(product) {
  return resolveProductCategory(product).key === "academic";
}

/** catalog line key used by storefront pills */
export function resolveCatalogLine(product) {
  return isAcademicProduct(product) ? "academic" : "app_premium";
}

/** Dedicated admin WhatsApp numbers - keep in sync with Footer. */
export const STORE_WHATSAPP = {
  app_premium: "6283136049987",
  academic: "6281232742374",
};

export const CATALOG_LINE_WHATSAPP = STORE_WHATSAPP;

export function buildSupportWhatsAppUrl(text = "", line = "app_premium") {
  const number = CATALOG_LINE_WHATSAPP[line] || STORE_WHATSAPP.app_premium;
  const trimmed = String(text || "").trim();
  return trimmed
    ? `https://wa.me/${number}?text=${encodeURIComponent(trimmed)}`
    : `https://wa.me/${number}`;
}

export function buildCatalogAdminWhatsAppUrl(product, { minPriceLabel = "", pageUrl = "" } = {}) {
  const line = resolveCatalogLine(product);
  const number = CATALOG_LINE_WHATSAPP[line] || STORE_WHATSAPP.app_premium;
  const name = String(product?.name || "produk ini").trim();
  const priceBit = minPriceLabel ? ` Mulai dari ${minPriceLabel}.` : "";
  const urlBit = pageUrl ? `\n${pageUrl}` : "";
  const message =
    line === "academic"
      ? `Halo Admin Jasa Akademik Imzaqi Store, saya tertarik dengan ${name}.${priceBit} Boleh dibantu info paket dan prosesnya?${urlBit}`
      : `Halo Admin App Premium Imzaqi Store, saya tertarik dengan ${name}.${priceBit} Boleh dibantu paket yang ready?${urlBit}`;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

/** Whether product matches selected catalog line filters (cats array) */
export function matchesCatalogLineFilters(product, cats = []) {
  if (!Array.isArray(cats) || cats.length === 0) return true;
  const line = resolveCatalogLine(product);
  const fine = resolveProductCategory(product).key;

  return cats.some((key) => {
    const k = String(key || "").toLowerCase();
    if (k === "app_premium" || k === "academic") return k === line;
    return line === "app_premium" && fine === k;
  });
}

export function countCatalogLines(products = []) {
  return (products || []).reduce(
    (acc, product) => {
      if (product && product.is_active === false) return acc;
      const line = resolveCatalogLine(product);
      acc[line] = (acc[line] || 0) + 1;
      return acc;
    },
    { app_premium: 0, academic: 0 }
  );
}