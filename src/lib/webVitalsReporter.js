const sent = new Set();

/**
 * Web Vitals observer.
 * Intentionally does NOT write `/__vitals/*` rows to `public.page_views`
 * so analytics and database storage stay clean.
 */
export async function reportWebVital({ name, value, id } = {}) {
  if (!name) return;
  const key = `${name}:${id || value}`;
  if (sent.has(key)) return;
  sent.add(key);

  if (import.meta.env?.DEV) {
    console.debug(`[web-vitals] ${name}: ${Math.round(Number(value || 0))}`);
  }
}

export function initWebVitals() {
  if (!import.meta.env?.DEV) return;
  import("../reportWebVitals.js").then(({ default: reportWebVitals }) => {
    reportWebVitals(reportWebVital);
  });
}
