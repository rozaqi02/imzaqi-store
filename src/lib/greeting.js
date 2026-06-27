const KEY = "imzaqi_buyer_name_v1";

export function saveBuyerName(name) {
  if (!name || name.trim().length < 2) return;
  try { localStorage.setItem(KEY, name.trim()); } catch {}
}

export function getBuyerName() {
  try { return localStorage.getItem(KEY) || ""; } catch { return ""; }
}
