import { supabase } from "./supabaseClient";
import { getVisitorIdAsUUID } from "./visitor";

const SESSION_KEY = "imzaqi_funnel_session_v1";

// ── Backend availability guard ────────────────────────────────────────────────
// `funnel_events` dan `get_funnel_summary` baru ada setelah
// supabase/migrations/0002_funnel_objects.sql diterapkan. Tanpa migration itu,
// setiap request pasti gagal (42P01 undefined_table / 42883 undefined_function).
// Kita deteksi sekali lalu berhenti mengirim request sia-sia selama sesi ini.
// Setelah migration diterapkan, reload halaman akan memulihkan tracking otomatis.
let backendAvailable = true;

const MISSING_BACKEND_CODES = new Set(["42P01", "42883"]);

function isMissingBackendError(error) {
  if (!error) return false;
  if (MISSING_BACKEND_CODES.has(String(error.code || ""))) return true;
  return /does not exist|42P01|42883/i.test(String(error.message || ""));
}

/** True bila objek funnel tersedia di database (tracking + RPC admin aktif). */
export function isFunnelBackendAvailable() {
  return backendAvailable;
}

function getSessionId() {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return getVisitorIdAsUUID();
  }
}

export function trackFunnelEvent(eventName, details = {}) {
  if (!backendAvailable) return;

  const payload = {
    visitor_id: getVisitorIdAsUUID(),
    session_id: getSessionId(),
    event_name: eventName,
    path: typeof window === "undefined" ? null : window.location.pathname,
    product_id: details.productId || null,
    variant_id: details.variantId || null,
    order_code: details.orderCode || null,
    metadata: details.metadata || {},
  };

  supabase
    .from("funnel_events")
    .insert(payload, { returning: "minimal" })
    .then(({ error }) => {
      if (isMissingBackendError(error)) backendAvailable = false;
    })
    .catch(() => {});
}

