const META_KEY = "imzaqi_cart_meta_v1";
const DISMISS_KEY = "imzaqi_cart_dismiss_v1";
const CHECKOUT_VISITED_KEY = "imzaqi_checkout_visited_v1";
const IDLE_MS = 30 * 60 * 1000;

export function markCheckoutVisited() {
  try {
    localStorage.setItem(CHECKOUT_VISITED_KEY, "1");
  } catch {}
}

export function touchCartActivity() {
  try {
    localStorage.setItem(META_KEY, JSON.stringify({ updatedAt: Date.now() }));
    localStorage.removeItem(DISMISS_KEY);
  } catch {}
}

export function shouldShowAbandonedCartReminder(itemCount) {
  if (!itemCount || itemCount <= 0) return false;
  try {
    if (!localStorage.getItem(CHECKOUT_VISITED_KEY)) return false;
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
    sessionStorage.setItem(DISMISS_KEY, "1");
  } catch {}
}