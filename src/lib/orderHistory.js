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

export function addOrderToHistory({ order_code, created_at, total_idr, status }) {
  const storage = safeStorage();
  if (!storage) return;
  try {
    const existing = getOrderHistory();
    const alreadyExists = existing.some((e) => e.order_code === order_code);
    if (alreadyExists) return;
    const next = [
      { order_code, created_at: created_at || new Date().toISOString(), total_idr: Number(total_idr || 0), status: status || "pending" },
      ...existing,
    ];
    storage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {}
}

export function updateOrderHistoryStatus(order_code, newStatus) {
  const storage = safeStorage();
  if (!storage) return;
  try {
    const existing = getOrderHistory();
    const next = existing.map((entry) =>
      entry.order_code === order_code ? { ...entry, status: newStatus } : entry
    );
    storage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {}
}
