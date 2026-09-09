import { supabase } from "./supabaseClient";
import { getVisitorIdAsUUID } from "./visitor";
import { makeOrderCode } from "./orderCode";

const RESERVATION_KEY = "imzaqi_active_reservation_v1";

function signatureOf({ items, promoCode, whatsapp }) {
  const lines = (items || []).map((item) => `${item.variant_id}:${item.qty || 1}`).sort().join("|");
  return `${lines}::${String(promoCode || "").toUpperCase()}::${String(whatsapp || "").replace(/\D/g, "")}`;
}

function isMissingReservationRpc(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "");
  if (/insufficient_stock|out_of_stock/i.test(message)) return false;
  return (
    code === "PGRST202" ||
    code === "PGRST200" ||
    code === "42883" ||
    code === "42P01" ||
    code === "42501" ||
    /create_pending_order_reservation.*(not find|does not exist|schema cache|permission)/i.test(message) ||
    /function.*does not exist/i.test(message)
  );
}

export function clearOrderReservation() {
  try { sessionStorage.removeItem(RESERVATION_KEY); } catch {}
}

export async function createOrderReservation({ items, promoCode, whatsapp, notes }) {
  const signature = signatureOf({ items, promoCode, whatsapp });
  try {
    const cached = JSON.parse(sessionStorage.getItem(RESERVATION_KEY) || "null");
    if (cached?.signature === signature && new Date(cached.reservation_expires_at).getTime() > Date.now()) {
      return cached;
    }
  } catch {}

  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const code = makeOrderCode();
    const { data, error } = await supabase.rpc("create_pending_order_reservation", {
      p_visitor_id: getVisitorIdAsUUID(), p_order_code: code, p_items: items,
      p_promo_code: promoCode || null, p_customer_whatsapp: whatsapp,
      p_notes: notes || null, p_reservation_minutes: 30,
    });
    if (!error) {
      const created = { ...(Array.isArray(data) ? data[0] : data), signature };
      try { sessionStorage.setItem(RESERVATION_KEY, JSON.stringify(created)); } catch {}
      return created;
    }
    if (isMissingReservationRpc(error)) {
      const fallback = {
        order_code: code,
        status: "legacy_checkout",
        reservation_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        legacy: true,
        signature,
      };
      try { sessionStorage.setItem(RESERVATION_KEY, JSON.stringify(fallback)); } catch {}
      return fallback;
    }
    lastError = error;
    if (error.code !== "23505") break;
  }

  // Gracefully fallback for non-stock errors so customer checkout is never blocked
  if (lastError && !/insufficient_stock|out_of_stock/i.test(String(lastError?.message || ""))) {
    const fallback = {
      order_code: makeOrderCode(),
      status: "legacy_checkout",
      reservation_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      legacy: true,
      signature,
    };
    try { sessionStorage.setItem(RESERVATION_KEY, JSON.stringify(fallback)); } catch {}
    return fallback;
  }

  throw lastError || new Error("Gagal mereservasi stok.");
}

export async function reportOrderPayment({ orderCode, phone, reference, proofUrl }) {
  const { data, error } = await supabase.rpc("report_order_payment", {
    p_order_code: orderCode, p_phone_suffix: String(phone || "").replace(/\D/g, "").slice(-4),
    p_payment_reference: reference || null, p_payment_proof_url: proofUrl || null,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}
