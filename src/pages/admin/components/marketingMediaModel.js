import { getVariantEffectivePrice, isKnownOutOfStock } from "../../../lib/format.js";

export const MEDIA_FORMATS = {
  square: { label: "Feed / Chat", ratio: "1:1", width: 1080, height: 1080 },
  story: { label: "Status / Story", ratio: "9:16", width: 1080, height: 1920 },
  banner: { label: "Banner", ratio: "16:9", width: 1920, height: 1080 },
};

export const MEDIA_STYLES = [
  {
    id: "best_seller",
    name: "Crystal Emerald",
    detail: "Hijau & putih bersih",
    bg: "#eef7f2",
    bg2: "#dff1e7",
    cardBg: "#ffffff",
    cardBorder: "rgba(0, 130, 80, 0.16)",
    ink: "#143f32",
    muted: "#426a5b",
    accent: "#059669",
    secondary: "#34d399",
    badgeText: "#ffffff",
    footerBg: "#0d2b21",
    footerInk: "#f4fbf7",
    headline: ["BANYAK", "YANG PILIH."],
    tag: "PILIHAN FAVORIT",
  },
  {
    id: "obsidian_pro",
    name: "Obsidian Pro",
    detail: "Gelap & neon hijau",
    bg: "#0b1310",
    bg2: "#13221c",
    cardBg: "#14211c",
    cardBorder: "rgba(52, 211, 153, 0.24)",
    ink: "#f3faf6",
    muted: "#9ec0b1",
    accent: "#10b981",
    secondary: "#34d399",
    badgeText: "#05261a",
    footerBg: "#172922",
    footerInk: "#f3faf6",
    headline: ["AKSES PREMIUM.", "TANPA BATAS."],
    tag: "BEST QUALITY",
  },
  {
    id: "flash_sale",
    name: "Promo Kilat",
    detail: "Krem & merah coral",
    bg: "#fff6e8",
    bg2: "#ffe8cc",
    cardBg: "#ffffff",
    cardBorder: "rgba(217, 45, 32, 0.18)",
    ink: "#3a1619",
    muted: "#704246",
    accent: "#d92d20",
    secondary: "#ffb020",
    badgeText: "#ffffff",
    footerBg: "#2c1114",
    footerInk: "#fff8f0",
    headline: ["HARGA KECIL.", "AKSES BESAR."],
    tag: "FLASH PROMO",
  },
  {
    id: "new_release",
    name: "Royal Cobalt",
    detail: "Indigo & lime tajam",
    bg: "#151d68",
    bg2: "#222e9c",
    cardBg: "#1e2984",
    cardBorder: "rgba(186, 244, 72, 0.3)",
    ink: "#f4f6ff",
    muted: "#bcc4f2",
    accent: "#bef264",
    secondary: "#38bdf8",
    badgeText: "#12184a",
    footerBg: "#0d1348",
    footerInk: "#f4f6ff",
    headline: ["BARU HADIR.", "SIAP PAKAI."],
    tag: "RILIS BARU",
  },
  {
    id: "student_promo",
    name: "Studio Lilac",
    detail: "Pastel ungu elegan",
    bg: "#f4eeff",
    bg2: "#e6d8ff",
    cardBg: "#ffffff",
    cardBorder: "rgba(109, 40, 217, 0.18)",
    ink: "#2d1747",
    muted: "#5f4978",
    accent: "#7c3aed",
    secondary: "#fb7185",
    badgeText: "#ffffff",
    footerBg: "#24113a",
    footerInk: "#f9f5ff",
    headline: ["IDE BESAR.", "BUDGET PAS."],
    tag: "HEMAT PELAJAR",
  },
  {
    id: "minimal_slate",
    name: "Minimal Noir",
    detail: "Monokrom & mint",
    bg: "#141619",
    bg2: "#1f2328",
    cardBg: "#1c2026",
    cardBorder: "rgba(255, 255, 255, 0.14)",
    ink: "#ffffff",
    muted: "#9ca3af",
    accent: "#00e694",
    secondary: "#e5e7eb",
    badgeText: "#062016",
    footerBg: "#0b0d0f",
    footerInk: "#ffffff",
    headline: ["RINGKAS.", "SIAP PAKAI."],
    tag: "PILIHAN CERDAS",
  },
];

export function activeVariants(product) {
  return (Array.isArray(product?.product_variants) ? product.product_variants : [])
    .filter(v => v.is_active !== false);
}

export function chooseVariant(product, id, discounts = new Map(), overrides = {}) {
  const variants = activeVariants(product);
  const selected = variants.find(v => String(v.id) === String(id));
  if (selected) return selected;
  const ready = variants.filter(v => !isKnownOutOfStock(v));
  const { reseller = false, variantMarkups = {}, productMarkups = {} } = overrides;
  const pId = product?.id != null ? String(product.id) : null;
  const pSlug = product?.slug != null ? String(product.slug).toLowerCase() : null;

  return [...(ready.length ? ready : variants)].sort((a, b) => {
    const price = v => {
      const eff = getVariantEffectivePrice(v, discounts) || Infinity;
      if (!reseller) return eff;
      const vId = String(v.id);
      let m = null;
      if (variantMarkups[vId] != null) m = Number(variantMarkups[vId]);
      else if (pId && productMarkups[pId] != null) m = Number(productMarkups[pId]);
      else if (pSlug && productMarkups[pSlug] != null) m = Number(productMarkups[pSlug]);
      else m = 15;
      return m > 0 ? Math.round(eff * (1 + m / 100)) : eff;
    };
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
  const vId = variant?.id != null ? String(variant.id) : null;
  const pId = product?.id != null ? String(product.id) : null;
  const pSlug = product?.slug != null ? String(product.slug).toLowerCase() : null;

  let customMarkup = null;
  if (vId && overrides.variantMarkups && overrides.variantMarkups[vId] != null) {
    customMarkup = Number(overrides.variantMarkups[vId]);
  } else if (pId && overrides.productMarkups && overrides.productMarkups[pId] != null) {
    customMarkup = Number(overrides.productMarkups[pId]);
  } else if (pSlug && overrides.productMarkups && overrides.productMarkups[pSlug] != null) {
    customMarkup = Number(overrides.productMarkups[pSlug]);
  }

  const hasCustom = customMarkup !== null && !isNaN(customMarkup);
  const markup = overrides.reseller
    ? (hasCustom ? customMarkup : (Number(overrides.defaultResellerPercent) || 15))
    : 0;

  const calculated = markup > 0 ? Math.round(effective * (1 + markup / 100)) : effective;
  const price = manual !== "" ? Number(manual) : calculated;
  if (!Number.isSafeInteger(price) || price < 0 || (manual && price === 0)) {
    throw new Error("Harga manual harus berupa angka lebih dari 0.");
  }
  const rawBase = Number(variant?.price_idr || 0);
  const base = markup > 0 ? Math.round(rawBase * (1 + markup / 100)) : rawBase;
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

export function buildCatalogEntries(products, scope = "products", discounts = new Map(), selectedProductId = "all", options = {}) {
  const {
    onlyActive = true,
    onlyInStock = false,
    resellerPrice = false,
    variantMarkups = {},
    productMarkups = {},
  } = options;
  const filteredProducts = (products || []).filter(p => {
    if (onlyActive && p.is_active === false) return false;
    if (onlyInStock) {
      const vars = Array.isArray(p.product_variants) ? p.product_variants : [];
      const validVars = onlyActive ? vars.filter(v => v.is_active !== false) : vars;
      if (!validVars.some(v => !isKnownOutOfStock(v))) return false;
    }
    return true;
  });

  const targetProducts = selectedProductId && selectedProductId !== "all"
    ? filteredProducts.filter(p => String(p.id) === String(selectedProductId))
    : filteredProducts;

  if (scope === "variants") {
    const entries = [];
    for (const product of targetProducts) {
      let variants = Array.isArray(product?.product_variants) ? product.product_variants : [];
      if (onlyActive) variants = variants.filter(v => v.is_active !== false);
      if (onlyInStock) variants = variants.filter(v => !isKnownOutOfStock(v));
      for (const variant of variants) {
        entries.push({
          id: `${product.id}-${variant.id}`,
          name: product.name,
          icon_url: product.icon_url,
          slug: product.slug,
          product,
          variant,
          offer: posterOffer(product, variant, discounts, {
            reseller: resellerPrice,
            variantMarkups,
            productMarkups,
          }),
        });
      }
    }
    return entries;
  }

  return targetProducts.map(product => {
    let variants = Array.isArray(product?.product_variants) ? product.product_variants : [];
    if (onlyActive) variants = variants.filter(v => v.is_active !== false);
    if (onlyInStock) variants = variants.filter(v => !isKnownOutOfStock(v));
    const variant = chooseVariant(
      { ...product, product_variants: variants },
      "",
      discounts,
      { reseller: resellerPrice, variantMarkups, productMarkups }
    );
    return {
      ...product,
      product,
      variant,
      offer: posterOffer(product, variant, discounts, {
        reseller: resellerPrice,
        variantMarkups,
        productMarkups,
      }),
    };
  });
}

export function normalizeMediaPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
}
