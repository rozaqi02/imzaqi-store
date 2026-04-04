const CATEGORY_LABELS = {
  streaming: "Streaming",
  music: "Music",
  tools: "Tools",
  learning: "Belajar",
  other: "Lainnya",
};

function normalizeCategory(value) {
  const key = String(value || "").trim().toLowerCase();
  return CATEGORY_LABELS[key] ? key : "other";
}

function sortByCreatedAtDesc(a, b) {
  const timeA = new Date(a?.created_at || 0).getTime();
  const timeB = new Date(b?.created_at || 0).getTime();
  return timeB - timeA;
}

export function buildStoreInsights({ products = [], testimonials = [], settings = {} } = {}) {
  const activeProducts = (products || []).filter((product) => product?.is_active !== false);
  const variants = activeProducts.flatMap((product) =>
    (product?.product_variants || [])
      .filter((variant) => variant?.is_active !== false)
      .map((variant) => ({
        ...variant,
        product_name: product?.name || "",
        category: normalizeCategory(product?.category),
      }))
  );

  const prices = variants
    .map((variant) => Number(variant?.price_idr || 0))
    .filter((value) => Number.isFinite(value) && value > 0);

  const soldProducts = activeProducts
    .map((product) => ({
      id: product?.id,
      name: product?.name || "Tanpa nama",
      slug: product?.slug || "",
      sold: (product?.product_variants || []).reduce((sum, variant) => sum + Number(variant?.sold_count || 0), 0),
      stock: (product?.product_variants || []).reduce((sum, variant) => sum + Number(variant?.stock || 0), 0),
    }))
    .sort((a, b) => b.sold - a.sold || a.name.localeCompare(b.name, "id"));

  const categoryCounts = activeProducts.reduce((acc, product) => {
    const key = normalizeCategory(product?.category);
    acc[key] = Number(acc[key] || 0) + 1;
    return acc;
  }, {});

  const topCategoryEntry = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0];
  const captionedTestimonials = (testimonials || []).filter((item) => String(item?.caption || "").trim());
  const latestTestimonial = (testimonials || []).slice().sort(sortByCreatedAtDesc)[0] || null;
  const qris = settings?.qris || {};
  const whatsapp = settings?.whatsapp || {};

  return {
    productCount: activeProducts.length,
    variantCount: variants.length,
    readyVariantsCount: variants.filter((variant) => Number(variant?.stock || 0) > 0).length,
    lowStockCount: variants.filter((variant) => {
      const stock = Number(variant?.stock || 0);
      return stock > 0 && stock <= 3;
    }).length,
    outOfStockCount: variants.filter((variant) => Number(variant?.stock || 0) <= 0).length,
    minPrice: prices.length ? Math.min(...prices) : 0,
    maxPrice: prices.length ? Math.max(...prices) : 0,
    topProduct: soldProducts.find((product) => product.sold > 0) || null,
    categoryCounts,
    topCategory: topCategoryEntry
      ? {
          key: topCategoryEntry[0],
          label: CATEGORY_LABELS[topCategoryEntry[0]] || CATEGORY_LABELS.other,
          count: topCategoryEntry[1],
        }
      : null,
    testimonialsCount: (testimonials || []).length,
    captionedTestimonialsCount: captionedTestimonials.length,
    uncaptionedTestimonialsCount: Math.max(0, (testimonials || []).length - captionedTestimonials.length),
    latestTestimonial,
    whatsappReady: Boolean(String(whatsapp?.number || "").trim()),
    qrisReady: Boolean(String(qris?.base_payload || qris?.image_url || process.env.REACT_APP_QRIS_BASE || "").trim()),
  };
}
