import { readyFlashPromotions } from "./storefrontPromotions";

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency", currency: "IDR", maximumFractionDigits: 0,
});

export function flashPrice(value) {
  return rupiah.format(value);
}

export function buildFlashOffers(sales, products, now = Date.now()) {
  const variants = new Map();
  products.forEach(product => (product.product_variants || []).forEach(variant => {
    if (product.slug && product.is_active !== false && variant.is_active !== false) {
      variants.set(variant.id, { product, variant });
    }
  }));
  const offers = new Map();
  readyFlashPromotions(sales, products, now).forEach(sale => {
    const record = variants.get(sale.variant_id);
    if (!record) return;
    const originalPrice = Number(record.variant.price_idr);
    const discountPercent = Number(sale.discount_percent);
    const discountedPrice = Math.round(originalPrice * (1 - discountPercent / 100));
    if (!Number.isFinite(originalPrice) || originalPrice <= 0 || discountedPrice <= 0 || discountedPrice >= originalPrice) return;
    // The API returns newest sales first, matching the discount ProductDetail applies.
    if (offers.has(sale.variant_id)) return;
    const rawStock = record.variant.stock;
    const stock = rawStock == null || rawStock === "" ? null : Number(rawStock);
    offers.set(sale.variant_id, {
      ...record, id: sale.variant_id, discountPercent, originalPrice, discountedPrice,
      saving: originalPrice - discountedPrice,
      endsAt: sale.ends_at,
      stock: Number.isFinite(stock) ? stock : null,
    });
  });
  return [...offers.values()].sort((a, b) => b.discountPercent - a.discountPercent || b.saving - a.saving);
}

export function flashCountdown(endsAt, now) {
  let remaining = Math.max(0, Math.ceil((Date.parse(endsAt) - now) / 1000)) || 0;
  const days = Math.floor(remaining / 86400);
  remaining %= 86400;
  return [
    ...(days ? [{ label: "hari", value: days }] : []),
    { label: "jam", value: Math.floor(remaining / 3600) },
    { label: "menit", value: Math.floor((remaining % 3600) / 60) },
    { label: "detik", value: remaining % 60 },
  ];
}
