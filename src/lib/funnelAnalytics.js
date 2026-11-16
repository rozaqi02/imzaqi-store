import { supabase } from "./supabaseClient";
import { getVisitorIdAsUUID } from "./visitor";

const SESSION_KEY = "imzaqi_funnel_session_v1";

// Backend availability guard
// `funnel_events` dan `get_funnel_summary` baru ada setelah
// supabase/migrations/0002_funnel_objects.sql diterapkan. Tanpa migration itu,
// setiap request pasti gagal (42P01 undefined_table / 42883 undefined_function).
// Kita deteksi sekali lalu berhenti mengirim request sia-sia.
// Setelah migration diterapkan, status pulih otomatis setelah TTL atau reset cache.
const UNAVAILABLE_KEY = "imzaqi_funnel_unavailable_v1";

function checkBackendUnavailable() {
  try {
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(UNAVAILABLE_KEY) === "true") {
      return true;
    }
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem(UNAVAILABLE_KEY);
      if (stored) {
        const timestamp = Number(stored);
        // Cached unavailable up to 12 hours
        if (Number.isFinite(timestamp) && Date.now() - timestamp < 12 * 60 * 60 * 1000) {
          return true;
        }
      }
    }
  } catch {}
  return false;
}

let backendAvailable = !checkBackendUnavailable();

const MISSING_BACKEND_CODES = new Set(["42P01", "42883", "PGRST204", "PGRST205", "PGRST301"]);

function isMissingBackendError(error) {
  if (!error) return false;
  if (MISSING_BACKEND_CODES.has(String(error.code || "")) || error?.status === 404 || error?.statusCode === 404) return true;
  return /does not exist|schema cache|42P01|42883|PGRST/i.test(String(error.message || ""));
}

function markBackendUnavailable() {
  backendAvailable = false;
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(UNAVAILABLE_KEY, "true");
    }
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(UNAVAILABLE_KEY, String(Date.now()));
    }
  } catch {}
}

/** True bila objek funnel tersedia di database (tracking + RPC admin aktif). */
export function isFunnelBackendAvailable() {
  return backendAvailable;
}

function getSessionId() {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : getVisitorIdAsUUID();
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

  try {
    const table = supabase?.from?.("funnel_events");
    if (typeof table?.insert !== "function") return;

    Promise.resolve(table.insert(payload, { returning: "minimal" }))
      .then((res) => {
        if (isMissingBackendError(res?.error)) {
          markBackendUnavailable();
        }
      })
      .catch(() => {});
  } catch {
    // Non-fatal analytics safeguard
  }
}
