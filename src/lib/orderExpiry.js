import { supabase } from "./supabaseClient";
import { warn } from "./log";

export const ORDER_EXPIRY_MINUTES = 60;

/**
 * Checks and releases expired pending orders.
 * Eliminates "Ghost Stock" by returning stock to product variants and releasing promo claims.
 * Tries the database RPC first, and gracefully falls back to client-assisted cancellation if RPC is unavailable.
 */
export async function autoReleaseExpiredOrders({ expiryMinutes = ORDER_EXPIRY_MINUTES } = {}) {
  // 1. Try atomic server RPC
  try {
    const { data, error } = await supabase.rpc("auto_release_expired_orders", {
      p_expiry_minutes: expiryMinutes,
    });
    if (!error && data) {
      const first = Array.isArray(data) ? data[0] : data;
      return {
        releasedCount: Number(first?.released_count || 0),
        orderCodes: Array.isArray(first?.order_codes) ? first.order_codes : [],
      };
    }
  } catch (rpcErr) {
    warn("auto_release_expired_orders RPC skipped/failed:", rpcErr);
  }

  // 2. Client-assisted fallback (find pending orders past expiry cutoff)
  try {
    const cutoff = new Date(Date.now() - expiryMinutes * 60 * 1000).toISOString();
    const { data: expiredOrders, error } = await supabase
      .from("orders")
      .select("id, order_code, created_at, status")
      .eq("status", "pending")
      .lt("created_at", cutoff)
      .limit(20);

    if (error || !expiredOrders?.length) {
      return { releasedCount: 0, orderCodes: [] };
    }

    const releasedCodes = [];
    for (const order of expiredOrders) {
      try {
        await supabase.rpc("cancel_order_with_stock_restore", { p_order_id: order.id });
        await supabase
          .from("orders")
          .update({
            status: "expired",
            admin_note: "[Auto-Release] Stok dikembalikan karena pembayaran kedaluwarsa.",
          })
          .eq("id", order.id);
        releasedCodes.push(order.order_code);
      } catch (cancelErr) {
        warn("Gagal merilis order kedaluwarsa:", order.order_code, cancelErr);
      }
    }

    return {
      releasedCount: releasedCodes.length,
      orderCodes: releasedCodes,
    };
  } catch (fallbackErr) {
    warn("autoReleaseExpiredOrders fallback error:", fallbackErr);
    return { releasedCount: 0, orderCodes: [] };
  }
}
