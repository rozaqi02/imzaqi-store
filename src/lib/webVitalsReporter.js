import { getVisitorIdAsUUID } from "./visitor";
import { supabase } from "./supabaseClient";

const sent = new Set();

export async function reportWebVital({ name, value, id }) {
  const key = `${name}:${id || value}`;
  if (sent.has(key)) return;
  sent.add(key);

  try {
    const visitorId = getVisitorIdAsUUID();
    await supabase.from("page_views").insert({
      visitor_id: visitorId,
      path: `/__vitals/${name}`,
      referrer: String(Math.round(value)),
    });
  } catch {
    // Analytics must never break UX
  }
}

export function initWebVitals() {
  import("../reportWebVitals.js").then(({ default: reportWebVitals }) => {
    reportWebVitals(reportWebVital);
  });
}