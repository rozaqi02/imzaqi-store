/**
 * Admin performance helpers — page sizes, select shapes, empty memo stubs, debounce.
 * Keep AdminDashboard lean; domain load flags live in the dashboard component.
 */

import { LIVE_ORDER_STATUSES } from "../../lib/orderStatus";

/** First page / load-more chunk — was 500 (too heavy). */
export const ORDERS_PAGE_SIZE = 40;

/** Stok tipis = hampir habis, tapi masih ada (bukan 0 / abis). Ambang: 0 < stock < 2 → hanya 1. */
export const STOCK_THIN_BELOW = 2;

export function isThinStock(stock) {
  const n = Number(stock || 0);
  // Kosong (0) bukan "tipis" — itu abis; tipis = sisa 1
  return n > 0 && n < STOCK_THIN_BELOW;
}

/** List row: enough for cards + filters; skip heavy detail fields. */
export const ORDER_SELECT_LIST =
  "id,order_code,created_at,status,items,subtotal_idr,discount_percent,total_idr,promo_code,customer_whatsapp,admin_note,reservation_expires_at,payment_reported_at,payment_reference,verification_status";

/** Full row for detail drawer / notes / proof. */
export const ORDER_SELECT_DETAIL =
  "id,order_code,created_at,status,items,subtotal_idr,discount_percent,total_idr,promo_code,payment_proof_url,customer_whatsapp,notes,admin_note,reservation_expires_at,payment_reported_at,payment_reference,verification_status";

/** Fallback when notes/admin_note columns missing. */
export const ORDER_SELECT_LIST_FALLBACK =
  "id,order_code,created_at,status,items,subtotal_idr,discount_percent,total_idr,promo_code,customer_whatsapp";

/** Short TTL for admin catalog (SWR-style session cache). */
export const ADMIN_PRODUCTS_CACHE_TTL_MS = 20_000;

/** Debounce window for "order baru" toasts under burst inserts. */
export const REALTIME_TOAST_DEBOUNCE_MS = 2_500;

export const EMPTY_ANALYTICS_SUMMARY = Object.freeze({
  revenueTotal: 0,
  revenueWindow: 0,
  todayRevenue: 0,
  todayOrders: 0,
  doneOrders: 0,
  pipelineValue: 0,
  discountTotal: 0,
  averageOrderValue: 0,
  trend: [],
  maxOrders: 1,
  maxRevenue: 1,
  statusMap: {},
  topProducts: [],
  categories: [],
  promoUsage: [],
  stockAlerts: [],
  conversionRatio: 0,
  activeProducts: 0,
  inactiveProducts: 0,
  activePromos: 0,
  activeTestimonials: 0,
});

export function liveStatusesArray() {
  return Array.from(LIVE_ORDER_STATUSES);
}

/**
 * Map UI order bucket → Supabase status filter.
 * null = no server filter (all).
 */
export function statusFilterForBucket(orderBucket) {
  if (!orderBucket || orderBucket === "all") return null;
  if (orderBucket === "attention") return { type: "in", values: liveStatusesArray() };
  return { type: "eq", value: orderBucket };
}

export function debounceLeadingTrailing(fn, waitMs) {
  let timer = null;
  let lastArgs = null;
  let pending = false;

  const flush = () => {
    timer = null;
    if (pending && lastArgs) {
      pending = false;
      const args = lastArgs;
      lastArgs = null;
      fn(...args);
    }
  };

  return (...args) => {
    lastArgs = args;
    if (!timer) {
      fn(...args);
      timer = setTimeout(flush, waitMs);
      pending = false;
      lastArgs = null;
    } else {
      pending = true;
    }
  };
}

/** Simple trailing debounce. */
export function debounce(fn, waitMs) {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, waitMs);
  };
}
