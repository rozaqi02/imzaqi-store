const KEY = "imzaqi_search_history_v1";
const MAX = 5;

export function getSearchHistory() {
  try {
    const raw = sessionStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((x) => typeof x === "string" && x.trim()) : [];
  } catch {
    return [];
  }
}

export function pushSearchHistory(term) {
  const value = String(term || "").trim();
  if (!value) return;
  try {
    const prev = getSearchHistory().filter((x) => x.toLowerCase() !== value.toLowerCase());
    sessionStorage.setItem(KEY, JSON.stringify([value, ...prev].slice(0, MAX)));
  } catch {
    // Ignore storage errors
  }
}

export function clearSearchHistory() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Ignore storage errors
  }
}