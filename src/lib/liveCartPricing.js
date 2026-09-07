import { fetchActiveFlashSales, fetchProducts } from "./api";
import { warn } from "./log";

export function sanitizeQty(value) {
  const qty = Math.floor(Number(value || 0));
  if (!Number.isFinite(qty)) return 1;
  return Math.max(1, Math.min(99, qty));
}

export async function buildLiveCartItems(items) {
  const [latestProducts, activeFlashSales] = await Promise.all([
    fetchProducts({ includeInactive: true, useCache: false }),
    fetchActiveFlashSales({ useCache: false }).catch((err) => {
      warn("Flash sales fetch failed in live cart pricing:", err);
      return null;
    }),
  ]);

  const flashSaleMap = new Map();
  if (activeFlashSales !== null) {
    (activeFlashSales || []).forEach((sale) => {
      flashSaleMap.set(String(sale.variant_id), sale.discount_percent);
    });
  }

  const variantMap = new Map();
  (latestProducts || []).forEach((product) => {
    (product?.product_variants || []).forEach((variant) => {
      variantMap.set(String(variant?.id || ""), { product, variant });
    });
  });

  const canonicalItems = (items || []).map((item) => {
    const variantId = String(item?.variant_id || "");
    if (!variantId) {
      throw new Error("Item keranjang tidak valid.");
    }

    const entry = variantMap.get(variantId);
    if (!entry) {
      throw new Error("Ada item yang sudah tidak tersedia.");
    }

    const productActive = entry.product?.is_active !== false;
    const variantActive = entry.variant?.is_active !== false;
    if (!productActive || !variantActive) {
      throw new Error("Ada item nonaktif di keranjang.");
    }

    const safeQty = sanitizeQty(item?.qty);
    let safePrice = Math.max(0, Number(entry.variant?.price_idr || 0));
    const flashDiscount = flashSaleMap.get(variantId);
    if (flashDiscount && flashDiscount > 0) {
      safePrice = Math.round(safePrice * (1 - flashDiscount / 100));
    } else if (activeFlashSales === null) {
      safePrice = Math.max(0, Number(item?.price_idr || safePrice));
    }

    return {
      ...item,
      variant_id: entry.variant.id,
      product_id: entry.product.id,
      product_name: String(entry.product?.name || item?.product_name || ""),
      variant_name: String(entry.variant?.name || item?.variant_name || ""),
      duration_label: String(entry.variant?.duration_label || item?.duration_label || ""),
      price_idr: safePrice,
      product_icon_url: String(entry.product?.icon_url || item?.product_icon_url || ""),
      description: String(entry.variant?.description || entry.product?.description || item?.description || ""),
      guarantee_text: String(entry.variant?.guarantee_text || item?.guarantee_text || ""),
      requires_buyer_email: !!entry.variant?.requires_buyer_email,
      stock: Number(entry.variant?.stock),
      qty: safeQty,
    };
  });

  if (!canonicalItems.length) {
    throw new Error("Keranjang kosong.");
  }

  return { items: canonicalItems, flashUnknown: activeFlashSales === null };
}
