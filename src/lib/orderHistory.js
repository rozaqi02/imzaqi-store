const HISTORY_KEY = "imzaqi_order_history_v1";

function safeStorage() {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getOrderHistory() {
  const storage = safeStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => entry && entry.order_code)
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  } catch {
    return [];
  }
}

export function addOrderToHistory({ order_code, created_at, total_idr, status, phone_suffix, items_summary, icon_url }) {
  const storage = safeStorage();
  if (!storage) return;
  try {
    const existing = getOrderHistory();
    const alreadyExists = existing.some((e) => e.order_code === order_code);
    if (alreadyExists) {
      const next = existing.map((entry) => entry.order_code === order_code
        ? {
            ...entry,
            total_idr: Number(total_idr ?? entry.total_idr),
            status: status || entry.status,
            phone_suffix: phone_suffix || entry.phone_suffix,
            items_summary: items_summary || entry.items_summary,
            icon_url: icon_url || entry.icon_url,
          }
        : entry);
      storage.setItem(HISTORY_KEY, JSON.stringify(next));
      return;
    }
    const next = [
      {
        order_code,
        created_at: created_at || new Date().toISOString(),
        total_idr: Number(total_idr || 0),
        status: status || "pending",
        phone_suffix: phone_suffix || "",
        items_summary: items_summary || "",
        icon_url: icon_url || "",
      },
      ...existing,
    ];
    storage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {}
}

export function updateOrderHistoryEntry(order_code, updates = {}) {
  const storage = safeStorage();
  if (!storage) return;
  try {
    const existing = getOrderHistory();
    const next = existing.map((entry) =>
      entry.order_code === order_code ? { ...entry, ...updates } : entry
    );
    storage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {}
}

export function updateOrderHistoryStatus(order_code, newStatus) {
  updateOrderHistoryEntry(order_code, { status: newStatus });
}

export function removeOrderFromHistory(order_code) {
  const storage = safeStorage();
  if (!storage) return;
  try {
    const existing = getOrderHistory();
    const next = existing.filter((entry) => entry.order_code !== order_code);
    storage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {}
}

export function clearOrderHistory() {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.removeItem(HISTORY_KEY);
  } catch {}
}
