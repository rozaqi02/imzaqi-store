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

export const BUYER_EMAIL_REQUIREMENT_REGEX =
  /(akun\s*buyer|buyer\s*akun|email\s*(buyer|pembeli)|wajib\s*email|butuh\s*email|email\s*aktivasi|aktivasi\s*akun|account\s*activation|send\s*email)/i;

export function variantNeedsBuyerEmail(item) {
  if (!item) return false;

  if (
    item?.requires_note ||
    item?.require_note ||
    item?.requires_buyer_email ||
    item?.require_buyer_email ||
    item?.needs_buyer_email
  ) {
    return true;
  }

  const blob = [
    item?.product_name,
    item?.variant_name,
    item?.name,
    item?.description,
    item?.duration_label,
    item?.guarantee_text,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return BUYER_EMAIL_REQUIREMENT_REGEX.test(blob);
}

export function phoneSuffix(value) {
  return String(value || "").replace(/\D/g, "").slice(-4);
}

