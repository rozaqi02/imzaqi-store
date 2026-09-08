const KEY = "imzaqi_buyer_details_v1";

export function loadBuyerDetails() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "{}");
    return { whatsapp: String(parsed.whatsapp || ""), email: String(parsed.email || "") };
  } catch {
    return { whatsapp: "", email: "" };
  }
}

export function saveBuyerDetails(details) {
  const next = { whatsapp: String(details.whatsapp || ""), email: String(details.email || "") };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  return next;
}

export function phoneSuffix(value) {
  return String(value || "").replace(/\D/g, "").slice(-4);
}

