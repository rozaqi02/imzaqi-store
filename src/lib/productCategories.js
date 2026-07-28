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

/** Storefront catalog pills — only two shop lines */
export const CATALOG_LINE_FILTERS = [
  { key: "app_premium", label: "Aplikasi Premium", icon: Smartphone },
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

export function resolveProductCategory(product) {
  const explicit = String(product?.category || "").trim().toLowerCase();
  const key = PRODUCT_CATEGORIES.some((item) => item.key === explicit)
    ? explicit
    : inferCategoryFromName(product?.name);

  return PRODUCT_CATEGORIES.find((item) => item.key === key) || PRODUCT_CATEGORIES.at(-1);
}

export function isAcademicProduct(product) {
  return resolveProductCategory(product).key === "academic";
}

/** catalog line key used by storefront pills */
export function resolveCatalogLine(product) {
  return isAcademicProduct(product) ? "academic" : "app_premium";
}

/** Whether product matches selected catalog line filters (cats array) */
export function matchesCatalogLineFilters(product, cats = []) {
  if (!Array.isArray(cats) || cats.length === 0) return true;
  const line = resolveCatalogLine(product);
  const fine = resolveProductCategory(product).key;

  return cats.some((key) => {
    const k = String(key || "").toLowerCase();
    if (k === "app_premium" || k === "academic") return k === line;
    // Legacy URL category keys map into the two storefront lines
    if (k === "academic") return line === "academic";
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