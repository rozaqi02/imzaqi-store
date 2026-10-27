const META_KEY = "imzaqi_cart_meta_v1";
const DISMISS_KEY = "imzaqi_cart_dismiss_v1";
const CHECKOUT_VISITED_KEY = "imzaqi_checkout_visited_v1";
const IDLE_MS = 30 * 60 * 1000;
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000;

export function markCheckoutVisited() {
  try {
    localStorage.setItem(CHECKOUT_VISITED_KEY, "1");
  } catch {}
}

export function touchCartActivity() {
  try {
    localStorage.setItem(META_KEY, JSON.stringify({ updatedAt: Date.now() }));
    // Dismiss lives in sessionStorage — clear both so cart edits can re-show the banner
    sessionStorage.removeItem(DISMISS_KEY);
    localStorage.removeItem(DISMISS_KEY);
  } catch {}
}

export function shouldShowAbandonedCartReminder(itemCount) {
  if (!itemCount || itemCount <= 0) return false;
  try {
    if (!localStorage.getItem(CHECKOUT_VISITED_KEY)) return false;
    // Dismiss berlaku 24 jam agar banner tidak muncul lagi tiap buka aplikasi
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_TTL_MS) return false;
    if (sessionStorage.getItem(DISMISS_KEY)) return false;
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return false;
    const { updatedAt } = JSON.parse(raw);
    return Date.now() - Number(updatedAt || 0) >= IDLE_MS;
  } catch {
    return false;
  }
}

export function dismissAbandonedCartReminder() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    sessionStorage.setItem(DISMISS_KEY, "1");
  } catch {}
}