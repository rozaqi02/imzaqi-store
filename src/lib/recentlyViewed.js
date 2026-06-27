const KEY = "imzaqi_recently_viewed_v1";
const MAX = 8;

function safeGet() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function safeSet(val) {
  try { localStorage.setItem(KEY, JSON.stringify(val)); } catch {}
}

export function addRecentlyViewed(product) {
  if (!product?.id) return;
  const existing = safeGet().filter((p) => p.id !== product.id);
  const entry = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    icon_url: product.icon_url || null,
    minPrice: product._minPrice || null,
    viewedAt: Date.now(),
  };
  safeSet([entry, ...existing].slice(0, MAX));
}

export function getRecentlyViewed() {
  return safeGet();
}

export function clearRecentlyViewed() {
  try { localStorage.removeItem(KEY); } catch {}
}
