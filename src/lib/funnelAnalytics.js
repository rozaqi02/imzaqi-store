import { supabase } from "./supabaseClient";
import { getVisitorIdAsUUID } from "./visitor";

const SESSION_KEY = "imzaqi_funnel_session_v1";

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

  supabase.from("funnel_events").insert(payload, { returning: "minimal" }).then(() => {}).catch(() => {});
}

